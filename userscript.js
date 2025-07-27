// ==UserScript==
// @name         BootSlate
// @namespace    https://github.com/tzway/bootslate
// @version      2025-07-26
// @description  Translate boot.dev lessons to other languages!
// @author       tzway
// @match        https://www.boot.dev/*
// @icon         https://www.boot.dev/favicon-16x16.png
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
    'use strict';
    // write something to initialize the storage so the storage is visible in settings
    if (GM_getValue("") === undefined) {
        GM_setValue("", "");
    }
    console.log("bootslate started");
    const config = {
        targetLanguage: "Chinese",
        llmUrl: "https://your-llm-api-provider/v1/chat/completions",
        llmModel: "model-name",
        llmKey: "your-api-key-here"
    }
    config.translatePrompt = `You are a professional English to ${config.targetLanguage} Programming Lesson translator. Respond only with the content in the original markdown formatting, either translated or rewritten. Do not add explanations, comments, or any extra text. Make sure the response is also in original markdown format. In most cases do not translate code blocks, or embedded html code while you can translate the comments in the code blocks.`;
    config.questionTranslatePrompt = `You are a professional Programming Course Translator. Please translate the following English programming test questions into ${config.targetLanguage}, paying special attention to maintaining consistency in technical terminology.
Requirements:
1. Maintain consistency in technical terminology (e.g., 'argument' and 'parameter' should not both be translated as '参数'; they need distinct translations)
2. Keep code blocks and markup language unchanged
3. Preserve the logical structure and format of the questions
4. The return format must be identical to the original JSON format, with all translated content contained within the JSON structure
Please translate the following content:`

    // Hash Function to reduce GM key size
    function generateContentHash(content) {
        // simple hash algorithm
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash |= 0;
        }
        return 'translation-hash-' + hash.toString(36);
    }

    // function that translates the markdown content, with the ability to cache/fetch previous translations
    function translate(content) {
        return new Promise((resolve, reject) => {
            // hash the content as GM storage key
            const cacheKey = generateContentHash(content);

            // try to fetch existing translation
            const cachedTranslation = GM_getValue(cacheKey);
            if (cachedTranslation) {
                console.log('Using cached translation from GM storage:', cacheKey);
                resolve(cachedTranslation);
                return;
            }

            // request the LLM api to translate when cache is not available
            GM_xmlhttpRequest({
                method: "POST",
                url: config.llmUrl,
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${config.llmKey}`
                },
                data: JSON.stringify({
                    model: config.llmModel,
                    messages: [
                        {role: "system", content: config.translatePrompt},
                        {role: "user", content: content}
                    ],
                    temperature: 0.2,
                    max_tokens: 4096
                }),
                responseType: "json",
                onload: function(response) {
                    if (response.status >= 200 && response.status < 300) {
                        const respData = response.response;
                        if (respData.choices && respData.choices.length > 0) {
                            const translated = respData.choices[0].message.content;

                            // store the translated stuff into the GM storage
                            GM_setValue(cacheKey, translated);
                            console.log('Saved translation to GM storage:', cacheKey);

                            resolve(translated);
                        } else {
                            reject(new Error("No translation content found in response"));
                        }
                    } else {
                        reject(new Error(`API error: ${response.status} ${response.statusText}`));
                    }
                },
                onerror: function(error) {
                    reject(error);
                }
            });
        });
    }
    // an extra translation function to translate the question object which is peculiar to MCQ questions
    function translateQuestion(questionObj) {
        return new Promise((resolve, reject) => {
            // hash the whole stringified question object as GM store key
            const contentString = JSON.stringify(questionObj);
            const cacheKey = generateContentHash('question-' + contentString);

            // check existing translation in the GM store
            const cachedTranslation = GM_getValue(cacheKey);
            if (cachedTranslation) {
                console.log('Using cached question translation');
                try {
                    resolve(JSON.parse(cachedTranslation));
                    return;
                } catch(e) {
                    console.warn('Failed to parse cached question translation', e);
                }
            }

            // use LLM to translate the question object (it is required to return json format)
            GM_xmlhttpRequest({
                method: "POST",
                url: config.llmUrl,
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${config.llmKey}`
                },
                data: JSON.stringify({
                    model: config.llmModel,
                    messages: [
                        {role: "system", content: config.questionTranslatePrompt},
                        {role: "user", content: contentString}
                    ],
                    temperature: 0.2,
                    max_tokens: 4096
                }),
                responseType: "json",
                onload: function(response) {
                    if (response.status >= 200 && response.status < 300) {
                        const respData = response.response;
                        if (respData.choices && respData.choices.length > 0) {
                            const translatedContent = respData.choices[0].message.content;

                            try {
                                // try to parse json into object
                                const translatedObj = JSON.parse(translatedContent);

                                // store the translated object
                                GM_setValue(cacheKey, translatedContent);
                                console.log('Saved question translation to cache');
                                // this line fixes a previous bug that
                                // when answering MCQ the webpage sends translated content as the answer.
                                // it resolves the bug using a brute force way to map the translated content to English content
                                for (let i = 0; i < translatedObj.Answers.length; i++) {
                                    const translatedAnswer = translatedObj.Answers[i];
                                    const originalAnswer = questionObj.Answers[i];
                                    GM_setValue(translatedAnswer, originalAnswer);
                                }

                                resolve(translatedObj);
                            } catch(e) {
                                console.error('Failed to parse translated question', e);
                                resolve(questionObj); // when parsing fails, fall back
                            }
                        } else {
                            reject(new Error("No translation content found in response"));
                        }
                    } else {
                        reject(new Error(`API error: ${response.status} ${response.statusText}`));
                    }
                },
                onerror: function(error) {
                    reject(error);
                }
            });
        });
    }
    
    const safeWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    // hijack the browser window fetch api
    const oldFetch = safeWindow.fetch;
    function hookFetch() {
        // check if it is a POST request
        // if it contains "submit" in the end of url
        // I assume it is for submission
        // and I will replace the answer (not only for mcq)
        const requestUrl = arguments[0];
        const requestOptions = arguments[1] || {};

        if (typeof requestUrl === 'string' &&
            requestUrl.endsWith('/submit') &&
            requestOptions.method === 'POST' &&
            requestOptions.body) {

            try {
                // parse request body
                const bodyObj = JSON.parse(requestOptions.body);
                if (bodyObj.input) {
                    // check gm store for English answer
                    const originalAnswer = GM_getValue(bodyObj.input);
                    if (originalAnswer) {
                        console.log(`Converting answer from "${bodyObj.input}" to "${originalAnswer}"`);
                        bodyObj.input = originalAnswer;
                        // replacee the request body, swapping the translated answer into English one
                        arguments[1] = {
                            ...requestOptions,
                            body: JSON.stringify(bodyObj)
                        };
                    }
                }
            } catch (e) {
                console.error('Error processing answer submission', e);
            }
        }

        return new Promise((resolve, reject) => {
            oldFetch.apply(this, arguments).then((response) => {
                const oldJson = response.json;

                // In most cases, response.json method is hijacked to replace English content into translations
                response.json = function () {
                    return new Promise((resolveJson, rejectJson) => {
                        oldJson.apply(this, arguments).then(async (result) => {
                            try {
                                // In this try block,
                                // check if the response body contains lesson info like readme and question
                                // replace correspondingly
                                if (result && result.Lesson) {
                                    const foundKeys = [];

                                    // add stuff to translate in an array
                                    for (const key in result.Lesson) {
                                        const lessonObj = result.Lesson[key];
                                        
                                        // check Readme markdown content
                                        if (lessonObj && lessonObj.Readme && typeof lessonObj.Readme === 'string') {
                                            foundKeys.push({
                                                key: key,
                                                obj: lessonObj,
                                                content: lessonObj.Readme,
                                                type: 'readme'
                                            });
                                        }

                                        // check MCQ question
                                        if (lessonObj && lessonObj.Question) {
                                            foundKeys.push({
                                                key: key,
                                                obj: lessonObj,
                                                content: lessonObj.Question,
                                                type: 'question'
                                            });
                                        }
                                    }

                                    // early return when no stuff to translate
                                    if (foundKeys.length === 0) {
                                        resolveJson(result);
                                        return;
                                    }

                                    // use a count variable to track translation progress
                                    let translationCount = 0;

                                    // translate one by one
                                    for (const item of foundKeys) {
                                        try {
                                            if (item.type === 'readme') {
                                                const translated = await translate(item.content);
                                                console.log("Readme translation completed for", item.key);
                                                item.obj.Readme = translated;
                                            } else if (item.type === 'question') {
                                                const translatedObj = await translateQuestion(item.content);
                                                console.log("Question translation completed for", item.key);
                                                item.obj.Question = translatedObj;
                                            }
                                        } catch (error) {
                                            console.error(`Translation failed for ${item.type} in ${item.key}`, error);
                                        } finally {
                                            translationCount++;

                                            // resolve the Promise when all translations done
                                            if (translationCount === foundKeys.length) {
                                                resolveJson(result);
                                            }
                                        }
                                    }
                                } else {
                                    // resolve early when the response pattern doesn't match static lesson data
                                    resolveJson(result);
                                }
                            } catch (error) {
                                console.error('Translation process failed', error);
                                resolveJson(result);
                            }
                        }).catch((error) => {
                            rejectJson(error);
                        });
                    });
                };

                resolve(response);
            }).catch(reject); // handle fetch error
        });
    }

    //apply the hijack
    safeWindow.fetch = hookFetch;

})();
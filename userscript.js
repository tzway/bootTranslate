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

    // 生成缓存键的哈希函数（使用字符串前缀避免与其它GM值冲突）
    function generateContentHash(content) {
        // 使用简单的哈希算法生成唯一标识
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash |= 0; // 转换为32位整数
        }
        return 'translation-hash-' + hash.toString(36);
    }

    // 带持久化缓存的翻译函数
    function translate(content) {
        return new Promise((resolve, reject) => {
            // 生成内容哈希作为缓存键
            const cacheKey = generateContentHash(content);

            // 从GM缓存获取已存储的翻译
            const cachedTranslation = GM_getValue(cacheKey);
            if (cachedTranslation) {
                console.log('Using cached translation from GM storage:', cacheKey);
                resolve(cachedTranslation);
                return;
            }

            // 如果不存在缓存，则请求API
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

                            // 将结果存入GM持久化存储
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
    // 专门翻译Question对象的函数
    function translateQuestion(questionObj) {
        return new Promise((resolve, reject) => {
            // 创建缓存键（使用整个问题的JSON字符串作为基础）
            const contentString = JSON.stringify(questionObj);
            const cacheKey = generateContentHash('question-' + contentString);

            // 检查缓存
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

            // 发送请求
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
                                // 尝试解析返回的JSON内容
                                const translatedObj = JSON.parse(translatedContent);

                                // 将结果存入缓存
                                GM_setValue(cacheKey, translatedContent);
                                console.log('Saved question translation to cache');
                                // 将中文选项存入缓存(暴力写法，可能非选择题导致未知bug）
                                for (let i = 0; i < translatedObj.Answers.length; i++) {
                                    const translatedAnswer = translatedObj.Answers[i];
                                    const originalAnswer = questionObj.Answers[i];
                                    GM_setValue(translatedAnswer, originalAnswer);
                                }

                                resolve(translatedObj);
                            } catch(e) {
                                console.error('Failed to parse translated question', e);
                                resolve(questionObj); // 解析失败时返回原始内容
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
    // 获取安全引用
    const safeWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    // 使用unsafeWindow安全劫持fetch
    const oldFetch = safeWindow.fetch;
    function hookFetch() {
        // 在发送请求前检查是否是提交答案的请求
        const requestUrl = arguments[0];
        const requestOptions = arguments[1] || {};

        // 检查是否是提交答案的POST请求
        if (typeof requestUrl === 'string' &&
            requestUrl.endsWith('/submit') &&
            requestOptions.method === 'POST' &&
            requestOptions.body) {

            try {
                // 解析请求体
                const bodyObj = JSON.parse(requestOptions.body);
                if (bodyObj.input) {
                    // 尝试获取原始答案
                    const originalAnswer = GM_getValue(bodyObj.input);
                    if (originalAnswer) {
                        console.log(`Converting answer from "${bodyObj.input}" to "${originalAnswer}"`);
                        bodyObj.input = originalAnswer;
                        // 更新请求体
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

                // 劫持response.json方法
                // 在hookFetch函数中
                response.json = function () {
                    return new Promise((resolveJson, rejectJson) => {
                        oldJson.apply(this, arguments).then(async (result) => {
                            try {
                                // 检查并翻译Readme内容
                                if (result && result.Lesson) {
                                    const foundKeys = [];

                                    // 首先遍历所有可能包含Readme的对象
                                    for (const key in result.Lesson) {
                                        const lessonObj = result.Lesson[key];

                                        // 检查子对象是否有Readme属性且是字符串
                                        if (lessonObj && lessonObj.Readme && typeof lessonObj.Readme === 'string') {
                                            foundKeys.push({
                                                key: key,
                                                obj: lessonObj,
                                                content: lessonObj.Readme,
                                                type: 'readme'
                                            });
                                        }

                                        // 检查是否有Question对象
                                        if (lessonObj && lessonObj.Question) {
                                            foundKeys.push({
                                                key: key,
                                                obj: lessonObj,
                                                content: lessonObj.Question,
                                                type: 'question'
                                            });
                                        }
                                    }

                                    // 如果没有需要翻译的内容
                                    if (foundKeys.length === 0) {
                                        resolveJson(result);
                                        return;
                                    }

                                    // 创建计数器，跟踪完成翻译的数量
                                    let translationCount = 0;

                                    // 处理每个需要翻译的内容
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

                                            // 当所有翻译完成时解析Promise
                                            if (translationCount === foundKeys.length) {
                                                resolveJson(result);
                                            }
                                        }
                                    }
                                } else {
                                    // 没有需要翻译的内容
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
            }).catch(reject); // 处理fetch错误
        });
    }

    // 安全应用fetch劫持
    safeWindow.fetch = hookFetch;

})();
/*
 Copyright 2015 Jesse Manek
 Licensed under the Apache License, Version 2.0 (the "License"); you may
 not use this file except in compliance with the License. You may obtain
 a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 License for the specific language governing permissions and limitations
 under
 */

var _ = require('lodash');
var marked = require('marked');
var fs = require('fs');
var highlight = require('highlight.js');
var Handlebars = require('handlebars');
var Promise = require('promise');

marked.setOptions({
    renderer: new marked.Renderer(),
    gfm: true,
    tables: true,
    breaks: false,
    pedantic: true,
    sanitize: false,
    smartLists: true,
    smartypants: false,
    highlight: function (code, lang) {
        return highlight.highlight(lang, code).value;
    }
});

//Easier than changing Slate's js
marked.defaults.langPrefix = 'highlight ';

Handlebars.registerHelper('str', function(item){
    return '"' + item + '"';
});

Handlebars.registerHelper('html', function(content){
    return new Handlebars.SafeString(content);
});

/**
 * return a parsed template
 *
 * @param markup
 * @param template
 */
module.exports = function (markup, template, includesLoader) {
    includesLoader = includesLoader || function () { return ''; };

    // // marked doens't recognize "shell"?
    markup = markup.replace(/```shell/gm, '```bash');
    markup = markup.split(/(?:^|\n)---\n/g);

    if (markup.length === 1) {
        throw new Error('No markdown page settings found!');
    }

    var data = {};
    var tokens = new marked.Lexer().lex(markup[1]);
    var token;
    var listName;

    for (var idx = 0; idx < tokens.length; idx++) {
        token = tokens[idx];

        if (token.type === 'list_item_start' && listName){
            token = tokens[idx+1].text;
            if (listName === 'language_tabs' && token === 'shell'){
                token = 'bash';
            }
            data[listName].push(token);
            idx += 2;
        }

        if (token.type === 'paragraph') {

            if (tokens[idx+1] !== undefined && tokens[idx+1].type === 'list_start') {

                listName = token.text.slice(0, -1);
                data[listName] = [];

            } else {

                token = token.text.split(': ');
                data[token[0]] = token[1];

            }
        }
    }

    var markdown = [];
    markdown.push(markup.slice(2).join(''));

    _.forEach(data['includes'], function (include) {
        // can be either a string or a promise
        markdown.push(includesLoader(include));
    });

    data['languages'] = JSON.stringify(data['language_tabs']);

    return new Promise(function (resolve, reject) {
        Promise.all(markdown)
            .then(
                function (res) {
                    data['content'] = marked(res.join(''))
                        .replace(/pre><code([^>]+)/g, 'pre$1><code');

                    resolve(Handlebars.compile(template)(data))
                }
            );
    });
};
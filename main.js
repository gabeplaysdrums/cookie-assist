'use strict';

const packageJson = require('./package.json');
const fs = require('fs');
const path = require('path');
const minify = require('@node-minify/core');
const uglifyjs = require('@node-minify/uglify-js');
const noCompress = require('@node-minify/no-compress');

const outputDir = './output'

if (!fs.existsSync(outputDir))
    fs.mkdirSync(outputDir);

function makeInstaller(outputHtml, versionSuffix, compressor) {
    var tokens = {};

    function replaceTokens(data) {
        Object.keys(tokens).forEach(function(name) {
            data = data.replaceAll(`{{${name}}}`, tokens[name]);
        });
        return data;
    }

    tokens['VERSION'] = packageJson.version + versionSuffix;

    var data = fs.readFileSync('./assist.template.js', 'utf8');
    data = replaceTokens(data);
    fs.writeFileSync(path.join(outputDir, 'assist.js'), data);

    var bookmarklet = null;

    minify({
        compressor: compressor,
        input: [
            './jquery-3.6.1.js',
            path.join(outputDir, 'assist.js'),
        ],
        output: path.join(outputDir, 'assist.min.js'),
        sync: true,
        callback: function(err, min) {
            if (err)
                throw (`minify failed: ${err}`);
            
            const encoded = encodeURIComponent(min);
            bookmarklet = `javascript:${encoded}`;
        }
    });

    tokens['BOOKMARKLET_URL'] = bookmarklet;

    var data = fs.readFileSync('./install.template.html', 'utf8');
    data = replaceTokens(data);
    fs.writeFileSync(outputHtml, data);
}

makeInstaller(path.join(outputDir, 'install.html'), '', uglifyjs);
makeInstaller(path.join(outputDir, 'install-dev.html'), '-dev', noCompress);
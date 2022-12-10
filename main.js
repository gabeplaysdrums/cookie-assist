'use strict';

const packageJson = require('./package.json');
const fs = require('fs');
const path = require('path');
const minify = require('@node-minify/core');
const uglifyjs = require('@node-minify/uglify-js');

const outputDir = './output'

if (!fs.existsSync(outputDir))
    fs.mkdirSync(outputDir);

var data = fs.readFileSync('./assist.template.js', 'utf8');
data = data.replace('{{VERSION}}', packageJson.version);
fs.writeFileSync(path.join(outputDir, 'assist.js'), data);

var bookmarklet = null;

minify({
    compressor: uglifyjs,
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

var data = fs.readFileSync('./install.template.html', 'utf8');
data = data.replace('{{BOOKMARKLET_URL}}', bookmarklet);
fs.writeFileSync(path.join(outputDir, 'install.html'), data);
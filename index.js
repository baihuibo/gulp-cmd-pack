/**
 * Created by 惠波 on 2015/7/16.
 * @edit by leiming on 2016-4-25
 * <p>1、修正模块引入的js路径相对当于父模块路径</p>
 * <p>2、对模板中的'字符进行替换（\'）</p>
 */
var through = require('through2');
var Promise = require('promise');
var path = require('path');
var fs = require('fs');
var gutil = require('gulp-util');
var _ = require('underscore');

var PLUGIN_NAME = 'gulp-cmd-pack';

module.exports = function (option) {

    option = option || {};
    option.mods = [];
    option.content = '';
    option.alias = option.alias || {};
    option.ignore = option.ignore || [];
    option.encoding = option.encoding || 'UTF-8';
    option.tmpExtNames = option.tmpExtNames || ['.ejs'];
    option.cache = {};

    if (option.base) {
        option.base = path.normalize(path.resolve(option.base, '.') + path.sep);
    }

    return through.obj(function (file, encoding, cb) {

        if (!file) {
            return cb();
        }

        if (!option.base) {
            gutil.log(gutil.colors.red(PLUGIN_NAME + ' error: `option.base` is required!'));
            return cb(null, file);
        }

        if (file.isBuffer()) {
            option.content = file.contents.toString();
            parseContents(option, file).then(function () {
                var jsFilePath = file.base + path.sep + file.relative;
                jsFilePath = path.normalize(jsFilePath);
                file.contents = new Buffer(comboContents(option));
                gutil.log(PLUGIN_NAME + ':', '✔ Module [' + jsFilePath + '] combo success.');
                cb(null, file);
            });
            return;
        }

        return cb(null, file);
    });
};
/**
 *@param id {String} 模块id
 *@param option {Object} 配置对象
 *@param parentDir {String} 父模块基路径
 **/
function getPath(id, option, parentDir) {
    var ret;
    var first = id.charAt(0);

    if (first === ".") {
        ret = path.resolve(parentDir || option.base, id);
    } else if (option.alias[id]) {
        ret = path.resolve(option.base, option.alias[id]);
    } else {// Top-level
        ret = (option.base + id);
    }
    return path.normalize(ret);
}

var sepReg = /\\/g;
function getId(filePath, option) {
    return filePath.replace(option.base, '').replace(sepReg, '/');
}

//解析模块
function parseMod(id, option, parentDir) {
    var ret = getPath(id, option, parentDir);

    var isAlias = option.alias[id];
    var ext = path.extname(ret);

    if (!ext || ext == '.min') {// 用来支持 xxx.min.js 模块引用
        ret += '.js';
    }

    var filePath = ret;
    ret = path.parse(ret);

    ret.id = isAlias ? id : getId(filePath, option);
    ret.filePath = filePath;
    //ret.dirPath = path.dirname(filePath);
    return ret;
}

/**
 * 修复匹配 `require('mod')` 时,多匹配一个字符的bug
 * 如: var name=require('./mod');
 * 之前匹配: `=require('./mod')`;
 * 修改之后: `require('./mod')`;
 * @type {RegExp}
 */
var REQUIRE_RE = /"(?:\\"|[^"])*"|'(?:\\'|[^'])*'|\/\*[\S\s]*?\*\/|\/(?:\\\/|[^\/\r\n])+\/(?=[^\/])|\/\/.*|\w+require\(.*\)|require\s*\(\s*(["'])(.+?)\1\s*\)/g;

//解析模块依赖列表
function parseDependencies(option, code, mod) {
    var ret = [];
    code.replace(REQUIRE_RE, function (m, m1, moduleId) {
        moduleId && ret.push(moduleId)
    });

    // 这里去重用来修复可能出现的重复引用模块,避免不必要的计算
    var deps = _.chain(ret).uniq().map(function (moduleId) {
        return parseMod(moduleId, option, mod.dir);
    }).value();

    mod.deps = deps;
    mod.code = code;
    option.mods.push(mod);

    return deps;
}

//模板模块处理
function parseTemplate(option, code, mod) {
    mod.code = 'module.exports = \'' + jsEscape(code) + '\';';
    mod.deps = [];
    option.mods.push(mod);
}


//解析模块树并且读取模块
function parseContents(option, file) {
    var mainModFilePath = path.resolve(file.base, file.relative);
    mainModDirPath = path.dirname(mainModFilePath);
    return new Promise(function (done) {
        var deps = parseDependencies(option, option.content, {
            root: true,
            id: option.mainId,
            dir: mainModDirPath,
            filePath: mainModFilePath
        });
        if (deps.length) {
            done(readDeps(option, deps));
        } else {
            done();
        }
    });
}

//读取文件
function readDeps(option, parentDeps) {

    var childDeps = [];

    var promises = parentDeps.map(function (mod) {
        return new Promise(function (resolve, reject) {

            if (option.ignore.indexOf(mod.id) > -1) {//忽略的模块
                return resolve();
            }

            if (option.cache[mod.filePath]) {
                return resolve();
            }

            var contents, deps;
            if (mod.ext === '.js' || option.tmpExtNames.indexOf(mod.ext) > -1) {
                try {
                    contents = fs.readFileSync(mod.filePath, option.encoding);
                } catch (_) {
                    reject("File [" + mod.filePath + "] not found.");
                    return;
                }

                option.cache[mod.filePath] = true;
            }

            if (mod.ext == '.js') {
                deps = parseDependencies(option, contents, mod);
                if (deps.length) {
                    childDeps = childDeps.concat(deps);
                }
            } else if (option.tmpExtNames.indexOf(mod.ext) > -1) {//插件支持
                parseTemplate(option, contents, mod);
            }

            resolve();
        });
    });

    return Promise.all(promises).then(function () {
        if (childDeps.length) {
            return readDeps(option, childDeps);
        }
    }, function (err) {
        gutil.log(gutil.colors.red(PLUGIN_NAME + ' Error: ' + err));
    })
        .catch(function (err) {
            gutil.log(gutil.colors.red(PLUGIN_NAME + ' error: ' + err.message));
            console.log(err.stack);
        });
}

var CMD_HEAD_REG = /define\(.*?function\s*\(.*?\)\s*\{/;
function comboContents(option) {
    var content = '';
    option.mods.forEach(function (mod) {
        var code = mod.code;

        //替换模块内部id
        code = transform(option, mod, code);

        var deps = '[],';
        if (mod.deps.length) {
            deps = '["' + _.pluck(mod.deps, 'id').join('","') + '"],';
        }

        var define = 'define(';
        //当主模块为空时，设置为匿名模块，以方便自动执行
        if (mod.id) {
            define += '"' + mod.id + '" ,';
        }
        define += deps + ' function(require , exports , module){';
        if (!CMD_HEAD_REG.test(code)) {//标准commonjs模块
            code = define + '\n' + code + '\n});';
        } else {//cmd 模块
            code = code.replace(CMD_HEAD_REG, define);
        }

        content += code + '\n';
    });
    return content;
}

function transform(option, mod, code) {
    code.replace(REQUIRE_RE, function (code_ref, m1, moduleId) {
        /**
         * code_ref 正则所匹配到的代码如 `require('./mod')`
         * moduleId 匹配到的模块路径或者id `./mod`
         */
        //条件:模块存在且不在忽略列表里 且 不在别名里 才对模块进行替换
        if (moduleId && option.ignore.indexOf(moduleId) == -1 && !option.alias[moduleId]) {
            var newId = getId(getPath(moduleId, option, mod.dir), option);

            if (!path.extname(newId)) {
                newId += '.js';
            }

            newId = 'require("' + newId + '")';
            code = code.replace(code_ref, newId);
        }
    });

    return code;
}
function jsEscape(content) {
    //替换符号 u2028 u2029 \f \b \t \r ' " \
    return content.replace(/([\u2029\u2028\f\b\t\r'"\\])/g, "\\$1")
        .replace(/\n/g, ' ');// 这里替换换行符为空格
}
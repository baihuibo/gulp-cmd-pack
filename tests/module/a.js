/**
 * Created by 惠波 on 2015/7/31.
 */

var deps = [require('./b')]; // 数组请求测试
var deps2 = (require('./b')); // 括弧请求测试(因为多匹配一个字符导致的问题)
var b = require('./b');
var tpl = require('./test.ejs');

var c = myrequire('mod'); //测试方法带有关键字时匹配不许通过
function myrequire(mod) {
    return mod;
}

exports.test = function () {
    console.log('module b : ' + b);
};

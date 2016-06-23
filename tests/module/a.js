/**
 * Created by 惠波 on 2015/7/31.
 */

var deps = [require('./b')];
var deps2 = (require('./b'));
var b = require('./b');
var tpl = require('./test.ejs');

exports.test = function () {
    console.log('module b : ' + b);
};

/**
 * Created by 惠波 on 2015/7/31.
 */
var a = require('./path/a');
var $ = require('./path2/jquery.min');
var soft = require('./path2/test.umn');
require('./path2/other');
var json = require('./path2/test');

a.test();

console.log('$', $);
console.log('soft', soft);
console.log('json', json);
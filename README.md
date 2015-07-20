# gulp-cmd-pack
seajs的cmd模块合并打包工具


## 安装

```bash
npm install gulp-cmd-pack
```

## 使用

```javascript
var gulp = require('gulp');
var cmdPack = require('gulp-cmd-pack');
var uglify = require('gulp-uglify');

gulp.task('cmd', function () {
    gulp.src('path/to/module/app.js') //main文件
        .pipe(cmdPack({
            mainId: 'app', //初始化模块的id
            base: 'path/to/module/', //base路径
            alias: {
                bootstrap: '../../bower_components/bootstrap/dist/js/bootstrap.min.js',
                dialog: '../../bower_components/art-dialog/dist/dialog-plus-min.js',
                customScrollBar: '../../bower_components/malihu-custom-scrollbar-plugin/jquery.mCustomScrollbar.min.js'
            },
            ignore: ['bootstrap', 'dialog', 'customScrollBar'] //这里的模块将不会打包进去
        }))
        .pipe(uglify({ //压缩文件，这一步是可选的
            mangle: {
                except: ['require']
            }
        }))
        .pipe(gulp.dest('path/dist/'));//输出到目录
});
```

## 模块依赖解析及合并规则

Module `path/module/a.js` :

```js
    //common module 规范
    var b = require( './b' );
    module.exports =  'a' + ' ' + b;
    
    //或者seajs的模块规范，require变量必须有，不能省略
    define(function(require , exports , module){
        var b = require( './b' );
        return  'a' + ' ' + b;
    });
```

Module `path/module/b.js` :

```js
    //common module
    module.exports = 'b';
    
    //or seajs module
    define(function(require){
        return 'b';
    });
```

gulp code :

```js
    var cmdPack = require('gulp-cmd-wrap');
    gulp.src( 'path/module/a.js' )
        .pipe( cmdPack({
            mainId : 'a',
            base : 'path/module'
        }))
        .pipe(gulp.dest('path/dist/'));
```

合并后 `path/dist/a.js` :

```
define('a',['b.js'],function(require , exports , module){
    var b = require( 'b.js' );
    return 'a' + ' ' + b;
});
define('b.js' , [] ,function(require , exports , module){
    return 'b';
});
```

页面上使用
```js
    seajs.config({
        base : 'path/dist/'
    });
    seajs.use('a');
```

### Option 参数说明
1. ·option.alias·  模块别名
    和seajs.config({alias : {}}) 的作用一样，使工具可以根据别名找到文件
2. ·option.ignore·  忽略模块
    忽略打包的文件，这样的模块不会被打包
3. ·option.encoding·  编码
    文件编码，默认 `UTF-8`
4. ·option.tmpExtNames·  模板后缀名
    模板文件支持，默认值为 `['.ejs']` ，吧字符串模板转换为标准模块：

template path/tmp/test.ejs
```
    <div><%= data.name %></div>
```

module path/module/test.js
```js
    var testStr = require('../tmp/test.ejs');
    var str = _.template(testStr , {data : {name : 'aa'}});
    //str = '<div>aa</div>'
```

gulp
```js
    var cmdPack = require('gulp-cmd-wrap');
    gulp.src( 'path/module/test.js' )
        .pipe( cmdPack({
            mainId : 'test',
            base : 'path/module'
        }))
        .pipe(gulp.dest('path/dist/'));
```
         
结果 path/dist/test
```js
define('test' , ['../tmp/test.ejs'] , function(require , exports , module){
    var testStr = require('../tmp/test.ejs');
    var str = _.template(testStr , {name : 'aa'});
    //str = '<div>aa</div>'
});

define('../tmp/test.ejs' , [] , function(require , exports , module){
    return '<div><%= data.name %></div>'
});
```
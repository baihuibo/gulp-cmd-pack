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
                dialog: '../bower_components/dialog/dialog.js',
                jquery: '../bower_components/jquery/dist/jquery.min.js'
            },
            ignore: ['bootstrap'] //这里的模块将不会打包进去
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
    //CommonJS 规范
    var b = require( './b' );
    module.exports =  'a' + ' ' + b;
    
    //或者cmd模块规范，require关键字必须有，不能省略
    define(function(require , exports , module){
        var b = require( './b' );
        return  'a' + ' ' + b;
    });
```

Module `path/module/b.js` :

```js
    //CommonJS
    module.exports = 'b';
    
    //or cmd
    define(function(require){
        return 'b';
    });
```

Gulp:

```js
    var cmdPack = require('gulp-cmd-wrap');
    gulp.src( 'path/module/a.js' )
        .pipe( cmdPack({
            mainId : 'a',
            base : 'path/module'
        }))
        .pipe(gulp.dest('path/dist/'));
```

Results `path/dist/a.js` :

```
define('a',['b.js'],function(require , exports , module){
    var b = require( 'b.js' );
    return 'a' + ' ' + b;
});
define('b.js' , [] ,function(require , exports , module){
    return 'b';
});
```

Use
```js
    seajs.config({
        base : 'path/dist/'
    });
    seajs.use('a');
```

## Option 参数说明
1. `option.alias`  模块别名
    作用和 `seajs.config({alias : {}})` 一样，使工具可以识别 `alias` 别名配置的路径
    
2. `option.ignore`  忽略模块列表
    写在此数组内的模块不会被打包(但是会保留require引用)
    
    Module `path/module/a.js` :
    ```js
        var $ = require('jquery');
        var b = require('./b');
        $('button').text('hello button !! ' + b);
    ```
    
    Module `path/module/b.js` : 
    ```js
        module.exports = 'b';
    ```
    
    Gulp :
    ```js
        var cmdPack = require('gulp-cmd-wrap');
        gulp.src( 'path/module/a.js' )
            .pipe( cmdPack({
                mainId : 'a',
                base : 'path/module',
                ignore : ['jquery']
            }))
            .pipe(gulp.dest('path/dist/'));
    ```
    
    Results `path/dist/a.js` :
    ```js
    define('a' , ['./b.js'] , function(require , exports , module){
       var $ = require('jquery');
       var b = require('./b.js');
       $('button').text('hello button !! ' + b);
    });
    
    define('./b.js' , [] , function(require , exports , module){
        module.exports = 'b';
    });
    ```
    
3. `option.encoding`  编码
    文件编码，默认 `UTF-8`
    
4. `option.tmpExtNames`  模板后缀名
    模板文件支持，默认值为 `['.ejs']` ，吧字符串模板转换为标准模块：
    
    Module `path/module/test.js` :
    ```js
        var testStr = require('../tmp/test.ejs');
        var str = _.template(testStr , {data : {name : 'aa'}});
        //str = '<div>aa</div>'
    ```
    Template `path/tmp/test.ejs` : 
    ```
        <div><%= data.name %></div>
    ```
    
    Gulp :
    ```js
        var cmdPack = require('gulp-cmd-wrap');
        gulp.src( 'path/module/test.js' )
            .pipe( cmdPack({
                mainId : 'test',
                base : 'path/module',
                tmpExtNames : ['.ejs'] //提供模板文件的后缀名用来区分模板
            }))
            .pipe(gulp.dest('path/dist/'));
    ```
         
    Results `path/dist/test.js` :
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
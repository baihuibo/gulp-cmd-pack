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

    module.exports = 'b';
    
    //or
    
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
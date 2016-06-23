/**
 * Created by 惠波 on 2015/7/31.
 */

var gulp = require('gulp');

var cmd = require('../index');

gulp.task('default', function () {
    gulp.src('module/main.js')
        .pipe(cmd({
            mainId: 'main',
            base: 'module'
        }))
        .pipe(gulp.dest('dist/'));
});
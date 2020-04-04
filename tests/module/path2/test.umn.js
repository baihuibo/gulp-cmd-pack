(function (global, factory) {
    typeof exports === 'object' ? module.exports = factory() :
        typeof define === 'function' && define.amd ? define(factory) :
            (global = global || self, global.soft = factory());
}(this, function () {
    return {
        version: '0.0.0'
    };
}));
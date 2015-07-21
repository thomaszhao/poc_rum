/* jshint sub: true */
(function(window, document) {
    'use strict';
    function getFilename() {
	// Thomas: 这是个正则，测试问号后面的参数是否含有radar-no-min
        return /radar-no-min/.test(window.location.search) ? 'api.unmin.js' : 'api.js';
    }

    function makeCreateFunction(events) {

        return function(settings) {
            //debugger;
            var result = copyObject(settings);
            result['impact'] = function(eventSettings) {
                //console.log('Pushing Impact event (TEMPORARY): ' + settings['zoneId'] + '-' + settings['customerId']);
                //console.log(this);
                //debugger;
                if (patchStubs(this)) {
                    this['impact'](eventSettings);
                } else {
                    events.push({
                        "owner": this,
                        "event": "impact",
                        "data": copyObject(eventSettings)
                    });
                }
            };
            result['impact']['stub'] = true;
            result['radar'] = function(eventSettings) {
                //console.log('Pushing Radar event (TEMPORARY): ' + settings['zoneId'] + '-' + settings['customerId']);
                //console.log(this);
                //debugger;
                if (patchStubs(this)) {
                    this['radar'](eventSettings);
                } else {
                    events.push({
                        "owner": this,
                        "event": "radar",
                        "data": copyObject(eventSettings)
                    });
                }
            };
            result['radar']['stub'] = true;
            return result;
        };
    }

    /**
     * @param {!Object} temp
     * @return {boolean}
     */
    function patchStubs(temp) {
        //debugger;
        var instance = window['cedexis']['api']['instance'];
        if (instance) {
            instance['patch'](temp);
            return true;
        }
        return false;
    }

    function copyObject(settings) {
        var result = {};
        for (var i in settings) {
            if (settings.hasOwnProperty(i)) {
                result[i] = settings[i];
            }
        }
        return result;
    }

    //debugger;
    window['cedexis'] = window['cedexis'] || {};
    window['cedexis']['api'] = window['cedexis']['api'] || {};
    window['cedexis']['api']['events'] = window['cedexis']['api']['events'] || [];
    window['cedexis']['api']['create'] = makeCreateFunction(window['cedexis']['api']['events']);

    function loadAsync() {
        var script = document.createElement('script');
        script.async = true;
        if ('crossOrigin' in script) {
            script.crossOrigin = 'anonymous';
        }
        script.src = './js/api.unmin.js';
        var temp = document.getElementsByTagName('script')[0];
        temp.parentNode.insertBefore(script, temp);
    }

    if (!/\bMSIE 6/.exec(window.navigator.userAgent)) {
        if (window.addEventListener) {
            window.addEventListener('load', loadAsync, false);
        } else if (window.attachEvent) {
            window.attachEvent('onload', loadAsync);
        }
    }
}(window, document));

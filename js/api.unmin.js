/**
 * © 2015 Cedexis Inc.
 * Radar JavaScript client
 * Application Version: 0.1.138
 * Build Timestamp: 1437151755
 */
(function(window,document) {
"use strict";
/**
 * @param {Object} source
 * @return {Object}
 */
function copyObject(source) {
    if (source) {
        var result = {};
        for (var i in source) {
            if (source.hasOwnProperty(i)) {
                result[i] = source[i];
            }
        }
        return result;
    }
    return null;
}

var y64encode = (function() {
    var keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._-";

    function utf8_encode(string) {
        string = string.replace(/\r\n/g, "\n");
        var utftext = "", n, c;
        for (n = 0; n < string.length; n += 1) {
            c = string.charCodeAt(n);
            if (c < 128) {
                utftext += String.fromCharCode(c);
            } else if ((c > 127) && (c < 2048)) {
                utftext += String.fromCharCode((c >> 6) | 192);
                utftext += String.fromCharCode((c & 63) | 128);
            } else {
                utftext += String.fromCharCode((c >> 12) | 224);
                utftext += String.fromCharCode(((c >> 6) & 63) | 128);
                utftext += String.fromCharCode((c & 63) | 128);
            }
        }
        return utftext;
    }

    return function(input) {
        var output = "", chr1, chr2, chr3, enc1, enc2, enc3, enc4, i = 0;

        input = utf8_encode(input);
        while (i < input.length) {
            chr1 = input.charCodeAt(i);
            i += 1;
            chr2 = input.charCodeAt(i);
            i += 1;
            chr3 = input.charCodeAt(i);
            i += 1;

            enc1 = chr1 >> 2;
            enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
            enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
            enc4 = chr3 & 63;

            if (isNaN(chr2)) {
                enc3 = enc4 = 64;
            } else if (isNaN(chr3)) {
                enc4 = 64;
            }

            output = output +
                keyStr.charAt(enc1) + keyStr.charAt(enc2) +
                keyStr.charAt(enc3) + keyStr.charAt(enc4);
        }
        return output;
    };
}());
// api.js
//

/**
 * @param {!Window} window
 * @param {!Document} document
 * @param {!Array.<!Object>} events
 * @constructor
 */
function RadarApi(window, document, events) {
    //debugger;
    /** @type {!Array.<!ApiEvent>} */
    this.__events = events;

    /** @type {!Window} */
    this.__window = window;

    /** @type {!Document} */
    this.__document = document;

    /** @type {string} */
    this.__samplerId = 'ap';

    /** @type {number} */
    this.__samplerMajorVersion = 0;

    /** @type {number} */
    this.__samplerMinorVersion = 4;

    /** @type {RadarSession} */
    this.__currentSession = null;

    /** @type {Handler} */
    this.__currentHandler = null;

    /** @type {boolean} */
    this.__pltSent = false;

    /** @type {boolean} */
    this.__handlersInstalled = false;

    /** @type {ResourceTimingHelper} */
    this.__resourceTimingHelper = new ResourceTimingHelper(this.__window);

    /** @type {boolean} */
    this.__loggingEnabled = false;
}

RadarApi.prototype.installHandlers = function() {
    //debugger;
    if (!this.__handlersInstalled) {
        if ('addEventListener' in this.__window) {
            this.__window.addEventListener('message', this.makeWindowMessageHandler(), false);
        }

        // Try to install Resource Timing buffer full event handler
        //this.__resourceTimingHelper.setResourceTimingBufferSize(20);
        this.__resourceTimingHelper.installResourceTimingBufferFullHandler();
    }
    this.__handlersInstalled = true;
};

/**
 * @return {boolean}
 */
RadarApi.prototype.getPltSent = function() {
    return this.__pltSent;
};

RadarApi.prototype.setPltSent = function() {
    this.__pltSent = true;
};

RadarApi.prototype.processNextEvent = function() {
    //debugger;
    // Check for queued events.
    //console.log('RadarApi.prototype.processNextEvent start:\n' + JSON.stringify(this.__events));
    if (!this.__currentHandler) {
        if (0 < this.__events.length) {
            /** @type {!ApiEvent} */
            var rawEvent = this.__events.shift();
            if (rawEvent['owner']) {
                this.substituteOwnerFunctions(rawEvent['owner']);
                if (rawEvent['owner']['logging']) {
                    this.__loggingEnabled = true;
                }
            }
            //debugger;
            if (!this.__currentSession) {
                if ('undefined' === typeof rawEvent['owner']['zoneId']) {
                    rawEvent['owner']['zoneId'] = 1;
                }
                /** @type {number} */
                var requestorZoneId = rawEvent['owner']['zoneId'];
                /** @type {number} */
                var requestorCustomerId = rawEvent['owner']['customerId'];
                /** @type {string} */
                var initDomain = rawEvent['data']['initDomain'];
                /** @type {string} */
                var reportDomain = rawEvent['data']['reportDomain'];
                /** @type {string} */
                var providersDomain = rawEvent['data']['providersDomain'];
                this.__currentSession = new RadarSession({
                    window: this.__window,
                    document: this.__document,
                    samplerId: this.__samplerId,
                    samplerMajorVersion: this.__samplerMajorVersion,
                    samplerMinorVersion: this.__samplerMinorVersion,
                    providersJsonpCallbackName: 'cedexis.api.instance.setProviders',
                    requestorZoneId: requestorZoneId,
                    requestorCustomerId: requestorCustomerId,
                    initDomain: initDomain,
                    reportDomain: reportDomain,
                    providersDomain: providersDomain,
                    transactionComparator: this.makeTransactionComparator(),
                    reportTag: '0'
                });
            }
            this.__currentHandler = this.createHandler(this.__currentSession, rawEvent);
            this.__currentHandler.processEvent();
        }
        // else {
        //     console.log('No more events in the queue');
        // }
    }
    // else {
    //     console.log('Another event handler is active.');
    // }
    //console.log('RadarApi.prototype.processNextEvent end:\n' + JSON.stringify(this.__events));
};

/**
 * @param {!RadarSession} session
 * @param {!Object} rawEvent
 * @return {!Handler}
 */
RadarApi.prototype.createHandler = function(session, rawEvent) {
    //debugger;
    //console.log(JSON.stringify(rawEvent));
    switch (rawEvent['event']) {
    case 'impact':
        return new ImpactHandler({
            parentApi: this,
            parentSession: session,
            rawEvent: rawEvent,
            window: this.__window
        });
    case 'radar':
        return new RadarHandler({
            parentApi: this,
            parentSession: session,
            data: rawEvent['data'] || {}
        });
    }
    return new NoopHandler();
};

/**
 * @param {*} owner
 */
RadarApi.prototype.substituteOwnerFunctions = function(owner) {
    // Replace the stubbed public functions with the real ones
    if (owner['impact'] && true === owner['impact']['stub']) {
        owner['impact'] = this.makeBeginImpactSessionFunction();
    }
    if (owner['radar'] && true === owner['radar']['stub']) {
        owner['radar'] = this.makeBeginRadarSessionFunction();
    }
};

/**
 * @param {*} stub
 */
RadarApi.prototype.patch = function(stub) {
    this.substituteOwnerFunctions(stub);
};

RadarApi.prototype['patch'] = RadarApi.prototype.patch;

/**
 * @param {!Object} owner
 * @return {!Object}
 */
function copyOwnerObject(owner) {
    var result = {};
    for (var i in owner) {
        if (owner.hasOwnProperty(i)
            && 'radar' !== i
            && 'impact' !== i) {
            result[i] = owner[i];
        }
    }
    return result;
}

/**
 * @return {function(Object)}
 */
RadarApi.prototype.makeBeginImpactSessionFunction = function() {
    /** @type {!RadarApi} */
    var api = this;
    return function(eventSettings) {
        //debugger;
        eventSettings = eventSettings || {};
        //console.log('Pushing Impact event: ' + this['zoneId'] + '-' + this['customerId']);
        api.appendEvent({
            'event': 'impact',
            'owner': copyOwnerObject(this),
            'data': copyObject(eventSettings)
        });
        api.processNextEvent();
    };
};

/**
 * @return {function(!Object)}
 */
RadarApi.prototype.makeBeginRadarSessionFunction = function() {
    /** @type {!RadarApi} */
    var api = this;
    return function(eventSettings) {
        //debugger;
        eventSettings = eventSettings || {};
        //console.log('Pushing Radar event: ' + this['zoneId'] + '-' + this['customerId']);
        api.appendEvent({
            'event': 'radar',
            'owner': copyOwnerObject(this),
            'data': copyObject(eventSettings)
        });
        api.processNextEvent();
    };
};

/**
 * @param {!Object} source
 * @return {!Array.<string>}
 */
RadarApi.prototype.keysFor = function(source) {
    if (isFunction(Object.keys)) {
        return Object.keys(source);
    }
    var result = [];
    for (var i in source) {
        if (source.hasOwnProperty(i)) {
            result.push(i);
        }
    }
    return result;
};

/**
 * @param {!Handler} handler
 * @param {boolean} clearSession
 */
RadarApi.prototype.finishCurrentEvent = function(handler, clearSession) {
    //debugger;
    if (handler === this.__currentHandler) {
        this.__currentHandler = null;
        if (clearSession) {
            this.__currentSession = null;
        }
        this.processNextEvent();
    }
};

/**
 * @return {Function}
 */
RadarApi.prototype.makeWindowMessageHandler = function() {
    var that = this;
    return function(event) {
        if (that.__currentSession) {
            that.__currentSession.processWindowMessage(event);
        }
    };
};

/**
 * @param {*} data
 */
RadarApi.prototype.setProviders = function(data) {
    //debugger;
    if (this.__currentSession) {
        this.__currentSession.onGotJsonpProviders(data);
    }
};

RadarApi.prototype['setProviders'] = RadarApi.prototype.setProviders;

/**
 * @param {Object} data
 * @return {string}
 */
RadarApi.prototype.getImpactReportValue = function(data) {
    if (data) {
        var stringified = JSON.stringify(data);
        /* jshint ignore:start */
        if (this.__loggingEnabled && 'undefined' !== typeof console) {
            console.log("Impact: " + stringified);
        }
        /* jshint ignore:end */
        return 'impact_kpi:' + y64encode(stringified);
    }
    return '0';
};

/**
 * @param {!Object} event
 */
RadarApi.prototype.insertEvent = function(event) {
    this.__events.splice(0, 0, event);
    //console.log('RadarApi.prototype.insertEvent; event inserted; ' + JSON.stringify(event));
};

/**
 * @param {!Object} event
 */
RadarApi.prototype.appendEvent = function(event) {
    this.__events.push(event);
    //console.log('RadarApi.prototype.appendEvent; event added; ' + JSON.stringify(event));
};

/**
 * @return {function(number):boolean}
 */
RadarApi.prototype.makeTransactionComparator = function() {
    var that = this;
    return function(value) {
        //debugger;
        if (that.__currentSession && value === that.__currentSession.getTransactionId()) {
            return true;
        }
        return false;
    };
};

RadarApi.prototype.checkResourceTimingBuffer = function() {
    this.__resourceTimingHelper.checkBuffer();
};
/**
 * @constructor
 * @implements {Handler}
 * @param {!ImpactHandlerSettings} settings
 */
function ImpactHandler(settings) {
    //debugger;
    /** @type {!Window} */
    this.__window = settings.window;

    /** @type {!RadarApi} */
    this.__parentApi = settings.parentApi;

    /** @type {!RadarSession} parentSession */
    this.__parentSession = settings.parentSession;

    /** @type {Object} */
    this.__kpiData = {};

    /** @type {string} */
    this.__impactSessionId = this.getImpactSessionId();

    /** @type {Object} */
    var data = settings.rawEvent['data'];

    /** @type {string|null} */
    this.__pageCategory = null;
    var temp = data['category'] || data['pageCategory'];
    if ('string' === typeof temp) {
        this.__pageCategory = temp;
    }

    temp = data['kpi'] || data['kpiData'];
    if (temp) {
        //debugger;
        for (var i in temp) {
            this.__kpiData[i] = temp[i];
        }
    }

    temp = data['conversion'];
    if (temp) {
        this.__kpiData[temp] = 1;
    }

    /** @type {Object} */
    var owner = settings.rawEvent['owner'];

    /** @type {number} */
    this.__sessionTimeout = 20;
    if ('number' === typeof owner['sessionTimeout']) {
        this.__sessionTimeout = owner['sessionTimeout'];
    }

    /** @type {string|null} */
    this.__cookieDomain = null;
    if ('string' === typeof owner['cookieDomain']) {
        this.__cookieDomain = owner['cookieDomain'];
    }

    /** @type {string|null} */
    this.__cookiePath = null;
    if ('string' === typeof owner['cookiePath']) {
        this.__cookiePath = owner['cookiePath'];
    }

    /** @type {string|null} */
    this.__site = null;
    if ('string' === typeof owner['site']) {
        this.__site = owner['site'];
    }

    /** @type {boolean} */
    this.__secureCookie = false;

    /** @type {boolean} */
    this.__executeRadar = true;
    temp = data['radar'];
    if ('boolean' === typeof temp) {
        this.__executeRadar = temp;
    }

    /** @type {!Object} */
    this.__eventData = settings.rawEvent['data'];
}

ImpactHandler.prototype.processEvent = function() {
    this.__parentSession.startInitRequest(this.makeInitCallback());
};

/**
 * @return {function(!Object)}
 */
ImpactHandler.prototype.makeInitCallback = function() {
    var that = this;
    return function() {
        //debugger;
        that.sendPltReport();
    };
};

ImpactHandler.prototype.sendPltReport = function() {
    //debugger;
    var impactData = {
        'sessionID': this.__impactSessionId
    };
    if (this.__site) {
        impactData['site'] = this.__site;
    }
    if (this.__pageCategory) {
        impactData['category'] = this.__pageCategory;
    }
    var kpiTuples = [];
    for (var i in this.__kpiData) {
        if (this.__kpiData.hasOwnProperty(i)) {
            //console.log(typeof this.__kpiData[i]);
            var valueType = typeof this.__kpiData[i];
            if ('string' !== valueType
                && 'number' !== valueType
                && 'boolean' !== valueType) {
                // jshint undef:false
                console.log('Radar API Warning: KPI values should be of types number, string or boolean (found ' + valueType + ')');
                // jshint undef:true
            }
            kpiTuples.push([i, this.__kpiData[i]]);
        }
    }
    if (0 < kpiTuples.length) {
        impactData['kpi'] = kpiTuples;
    }
    this.__parentSession.sendPltReport({
        reportTag: this.__parentApi.getImpactReportValue(impactData),
        pltSent: this.__parentApi.getPltSent()
    });
    this.__parentApi.setPltSent();
    if (this.__executeRadar) {
        //debugger;
        this.__parentApi.insertEvent({ 'event': 'radar' });
        this.__parentApi.finishCurrentEvent(this, false);
    } else {
        this.__parentApi.finishCurrentEvent(this, true);
    }
};

/**
 * @param {string} name
 * @param {string} value
 * @param {string|null} domain
 * @param {string|null} path
 * @param {boolean} secureOnly
 * @param {number} expiresInDays
 */
ImpactHandler.prototype.setCookie = function(name, value, domain, path,
    secureOnly, expiresInDays) {
    //debugger;
    var cookieParts = [ encodeURIComponent(name) + '=' + encodeURIComponent(value) ];
    var d = new Date();
    d.setTime(d.getTime() + (expiresInDays*24*60*60*1000));
    cookieParts.push('expires=' + d.toUTCString());
    cookieParts.push('path=' + (path || '/'));
    //cookieParts.push('path=/');
    if (domain) {
        cookieParts.push('domain=' + domain);
    }
    if (secureOnly) {
        cookieParts.push('secure');
    }
    //console.log(cookieParts.join(';'));
    this.__parentSession.setCookie(cookieParts.join(';'));
};

/**
 * @return {string}
 */
ImpactHandler.prototype.getImpactSessionId = function() {
    //debugger;
    var sessionIdParts;
    var cookieName = 'impactSession-'
        + this.__parentSession.getRequestorZoneId()
        + '-'
        + this.__parentSession.getRequestorCustomerId();
    var sessionIdCookie = this.__parentSession.getCookie(cookieName);
    if (!sessionIdCookie) {
        sessionIdParts = this.makeSessionId();
        //debugger;
        this.__kpiData['new'] = true;
    } else {
        // Check the "last event" timestamp
        var cookieValueParts = sessionIdCookie.split('-');
        var now = (new Date()).getTime();
        // ex: 1415582287978
        var then = parseInt(cookieValueParts[1], 10);
        //console.log('Then: ' + then);
        //console.log('Now:  ' + now);
        var difference = (now - then);
        //var difference = (now - then) / 1000 * 60;
        //console.log('The last event was ' + difference + ' milliseconds ago');
        difference /= 60000;
        //console.log('The last event was ' + difference + ' minutes ago');
        if (difference >= this.__sessionTimeout) {
            // New sessionId
            sessionIdParts = this.makeSessionId();
            //debugger;
            this.__kpiData['new'] = true;
        }
        else {
            // The sessionId has not expired; update the "last event" timestamp
            sessionIdParts = [
                cookieValueParts[0],
                (new Date()).getTime()
            ];
        }
    }
    this.setCookie(
        cookieName,
        sessionIdParts.join('-'),
        // 'a',
        // 'b',
        this.__cookieDomain,
        this.__cookiePath,
        this.__secureCookie,
        7
    );
    return sessionIdParts[0];
};

/**
 * @return {Array}
 */
ImpactHandler.prototype.makeSessionId = function() {
    var crypto = this.__window['crypto'] || this.__window['msCrypto'];
    var sessionId;
    if (crypto && crypto['getRandomValues']) {
        var values = new Uint32Array(1);
        crypto['getRandomValues'](values);
        sessionId = values[0];
    }
    sessionId = sessionId || Math.floor(1000000000 * Math.random());

    var result = [
        sessionId.toString(),
        (new Date()).getTime() // "last event" timestamp
    ];

    return result;
};
/**
 * @constructor
 * @implements {Handler}
 * @param {RadarHandlerSettings} settings
 */
function RadarHandler(settings) {
    /** @type {!RadarApi} parentApi */
    this.__parentApi = settings.parentApi;

    /** @type {!RadarSession} parentSession */
    this.__parentSession = settings.parentSession;

    this.__parentSession.setSessionFinishedCallback(this.makeSessionFinishedCallback());

    /** @type {!Object} */
    this.__eventData = settings.data;
}

RadarHandler.prototype.processEvent = function() {
    //debugger;
    //console.log(this.__eventData);
    this.__parentApi.checkResourceTimingBuffer();
    // Do an init request if necessary
    if (this.__parentSession.hasRequestSignature()) {
        this.beginSession();
    } else {
        this.__parentSession.startInitRequest(this.makeInitCallback());
    }
};

/**
 * @return {function(!Object)}
 */
RadarHandler.prototype.makeInitCallback = function() {
    var that = this;
    return function() {
        that.beginSession();
    };
};

RadarHandler.prototype.beginSession = function() {
    //debugger;
    // We skip PLT here because the first Impact event will
    // cause it to be sent
    this.__parentSession.requestProviders();
};

/**
 * @return {!Function}
 */
RadarHandler.prototype.makeSessionFinishedCallback = function() {
    var that = this;
    return function() {
        that.__parentApi.finishCurrentEvent(that, true);
    };
};
/**
 * @constructor
 * @implements {Handler}
 */
function NoopHandler() {}

NoopHandler.prototype.processEvent = function() {};
/** @const {number} */
var standardSmallObjectTimeout = 4000;

/** @const {number} */
var standardLargeObjectTimeout = 4000;

/**
 * @param {SessionProperties} sessionProperties
 * @param {ProbeSettings} probeSettings
 * @param {string} probeId
 * @return {string}
 */
function makeProbeUrlCacheBuster(sessionProperties, probeSettings, probeId) {
    return [
        probeId,
        sessionProperties.requestorZoneId,
        sessionProperties.requestorCustomerId,
        probeSettings.provider.getZoneId(),
        probeSettings.provider.getCustomerId(),
        probeSettings.provider.getProviderId(),
        sessionProperties.transactionId,
        sessionProperties.requestSignature
    ].join('-');
}

/**
 * @param {SessionProperties} sessionProperties
 * @param {ProbeSettings} probeSettings
 * @return {string}
 */
function makeUniUrlCacheBuster(sessionProperties, probeSettings) {
    return [
        sessionProperties.requestorZoneId,
        sessionProperties.requestorCustomerId,
        probeSettings.provider.getZoneId(),
        probeSettings.provider.getCustomerId(),
        probeSettings.provider.getProviderId(),
        makeRandomString(8),
        sessionProperties.requestSignature
    ].join('-');
}

/**
 * @param  {number} length
 * @param  {string=} alphabet
 * @return {string}
 */
function makeRandomString(length, alphabet) {
    alphabet = alphabet || 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var result = [];
    for (var i = 0; i < length; i += 1) {
        result.push(alphabet.charAt(getRandomInt(0, alphabet.length - 1)));
    }
    return result.join('');
}

/**
 * @param {number} min
 * @param {number} max
 * @return {number}
 */
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * @param {string} url
 * @return {string}
 */
function resourceTypeFromUrl(url) {
    //debugger;
    var filename = url.slice(url.lastIndexOf('/') + 1);
    if (/\.js(\?)?/i.test(filename)) {
        return 'script';
    }
    if (/\.(ico|png|bmp|gif|jpg|jpeg)(\?)?/i.test(filename)) {
        return 'image';
    }
    if (/\.(htm(l)?)(\?)?/i.test(filename)) {
        return 'html;custom';
    }
    // Don't guess
    return 'unknown';
}

/**
 * @param {!Probe} probe
 * @param {!SessionProperties} sessionProperties
 * @param {!ProbeSettings} probeSettings
 * @return {!ProbeBehavior}
 */
function createProbeBehavior(probe, sessionProperties, probeSettings) {
    //console.log(sessionProperties);
    //console.log(probeSettings);
    //debugger;
    var url = probeSettings.baseUrl;
    if (probeSettings.provider.getCacheBusting()) {
        /** @type {string} */
        var cacheBuster = '?rnd=';
        if (-1 < url.indexOf('?', 0)) {
            cacheBuster = '&rnd=';
        }
        cacheBuster += makeProbeUrlCacheBuster(
            sessionProperties,
            probeSettings,
            probe.getQueryStringProbeId()
        );
        url += cacheBuster;
    }

    if ('auto' === probeSettings.resourceType) {
        probeSettings.resourceType = resourceTypeFromUrl(probeSettings.baseUrl);
    }

    switch (probeSettings.resourceType) {
    case 'image':
        return new ImageProbeBehavior(probeSettings, url, probe);
    case 'image;dns':
        if (!!(url = makeDnsMeasurementUrl(url))) {
            return new DnsProbeBehavior(probeSettings, url, probe);
        }
        break;
    case 'script':
        return new ScriptProbeBehavior(probeSettings, url, probe);
    case 'html;dsa':
        return new DynamicPageProbeBehavior(probeSettings, url, probe);
    default:
        throw notImplemented('createProbeBehavior for ' + probeSettings.resourceType);
    }
    return new NoopProbeBehavior(probeSettings, probe);
}

/**
 * @param {!Probe} probe
 * @param {!SessionProperties} sessionProperties
 * @param {!ProbeSettings} probeSettings
 * @return {!ProbeBehavior}
 */
function createCacheNodeIdDetectionBehavior(probe, sessionProperties, probeSettings) {
    var url = probeSettings.baseUrl;
    if (probeSettings.provider.getCacheBusting()) {
        /** @type {string} */
        var cacheBuster = '?rnd=';
        if (-1 < url.indexOf('?', 0)) {
            cacheBuster = '&rnd=';
        }
        cacheBuster += makeUniUrlCacheBuster(sessionProperties, probeSettings);
        url += cacheBuster;
    }
    switch (probeSettings.resourceType) {
    case 'uni;jsonp':
        return new JsonpUniProbeBehavior(probeSettings, url, probe, sessionProperties);
    case 'uni;ajax':
        return new AjaxUniProbeBehavior(probeSettings, url, probe, sessionProperties);
    default:
        throw notImplemented('createCacheNodeIdDetectionBehavior for ' + probeSettings.resourceType);
    }
}

/**
 * @param {!BrowserProperties} browserProperties
 * @param {string} source
 * @param {SessionProperties} sessionProperties
 * @return {!Array.<!Provider>}
 */
function providersFromJson(browserProperties, source, sessionProperties) {
    //debugger;
    // Try to parse the response text as JSON
    var parsed;
    try {
        parsed = JSON.parse(source);
    } catch (ignore) {}
    return providersFromParsed(parsed, browserProperties, sessionProperties);
}

/**
 * @param {*} data
 * @param {!BrowserProperties} browserProperties
 * @param {SessionProperties} sessionProperties
 * @return {!Array.<!Provider>}
 */
function providersFromParsed(data, browserProperties, sessionProperties) {
    var result = [];
    if (data) {
        //console.log(parsed);
        for (var i = 0; i < data.length; i++) {
            var provider = new Provider(data[i], browserProperties, sessionProperties);
            provider.addMeasurementReadyHandler(sessionProperties.measurementReady);
            result.push(provider);
        }
    }
    return result;
}

/**
 * @param {number} elapsed
 * @param {string} url
 * @return {number}
 */
function measurementFromInterval(elapsed, url) {
    var rx = /(\d+)kb\./i;
    var matches = rx.exec(url);
    if (matches && matches[1]) {
        var fileSize = parseInt(matches[1], 10);
        // [8 kilobits / 1 KB] * [1000 ms / 1 sec] * [fileSize (in KB) / elapsed (in ms)]
        return Math.floor(8 * 1000 * fileSize / elapsed);
    }
    return 0;
}

/**
 * @param {string} name
 * @return {string}
 */
function notImplemented(name) {
    return name + ' not implemented';
}

/**
 * @param {*} obj
 * @return {boolean}
 */
function isFunction(obj) {
    return 'function' === typeof obj;
}

/**
 * @param {*} obj
 * @return {boolean}
 */
function isDefined(obj) {
    return 'undefined' !== typeof obj;
}

/**
 * @param {string} url
 * @return {string|null}
 */
function makeDnsMeasurementUrl(url) {
    var slashSlashIndex = url.indexOf('//');
    if (-1 < slashSlashIndex) {
        var temp = url.substring(slashSlashIndex + 2);
        var protocol = '//';
        if (0 < slashSlashIndex) {
            protocol = url.substring(0, slashSlashIndex) + '//';
        }
        var parts = temp.split('/');
        parts[0] = makeRandomString(63, 'abcdefghijklmnopqrstuvwxyz') + '.' + parts[0];
        return protocol + parts.join('/');
    }
    return null;
}
/**
 * @constructor
 * @param {!Window} window
 */
function ResourceTimingHelper(window) {
    /** @type {!Window} */
    this.__window = window;

    /** @type {boolean} */
    this.__clearManually = false;
}

/**
 * @param {number} maxSize
 */
ResourceTimingHelper.prototype.setResourceTimingBufferSize = function(maxSize) {
    var perf = this.getPerformanceObject();
    if (perf) {
        var fun = perf['setResourceTimingBufferSize'] || perf['webkitSetResourceTimingBufferSize'];
        if (fun) {
            fun.call(perf, maxSize);
            //console.log('Resource timing buffer size set: ' + maxSize);
        }
    }
};

ResourceTimingHelper.prototype.installResourceTimingBufferFullHandler = function() {
    var perf = this.getPerformanceObject();
    if (perf) {
        // debugger;
        var handler = this.makeResourceTimingBufferFullHandler();
        if (perf.addEventListener
            && 'undefined' !== typeof perf['onresourcetimingbufferfull']) {
            perf.addEventListener('resourcetimingbufferfull', handler, false);
        } else if (perf.addEventListener
            && 'undefined' !== typeof perf['onwebkitresourcetimingbufferfull']) {
            perf.addEventListener('webkitresourcetimingbufferfull', handler, false);
        } else if ('undefined' !== typeof perf['onresourcetimingbufferfull']) {
            perf['onresourcetimingbufferfull'] = handler;
        } else {
            this.__clearManually = true;
        }
        //this.__clearManually = true;
    }
};

/**
 * @return {Function}
 */
ResourceTimingHelper.prototype.makeResourceTimingBufferFullHandler = function() {
    var that = this;
    return function() {
        that.clearResourceTimingBuffer();
    };
};

ResourceTimingHelper.prototype.checkBuffer = function() {
    if (this.__clearManually) {
        //debugger;
        var maxEntries = 300;
        this.setResourceTimingBufferSize(maxEntries);
        var entries = this.getResourceEntries();
        if (entries) {
            //console.log('RT entry count: ' + entries.length);
            if ((maxEntries - 50) < entries.length) {
                //debugger;
                this.clearResourceTimingBuffer();
            }
        }
    }
};

/**
 * @return {Object}
 */
ResourceTimingHelper.prototype.getPerformanceObject = function() {
    if ('performance' in this.__window) {
        return this.__window['performance'];
    }
    return null;
};

ResourceTimingHelper.prototype.clearResourceTimingBuffer = function() {
    //debugger;
    var perf = this.getPerformanceObject();
    if (perf) {
        var fun = perf['clearResourceTimings'] || perf['webkitClearResourceTimings'];
        if (fun) {
            fun.call(perf);
            //console.log('Resource timing buffer cleared');
        }
    }
};

ResourceTimingHelper.prototype.getResourceEntries = function() {
    var perf = this.getPerformanceObject();
    if (perf) {
        if (perf && perf['getEntriesByType']) {
            return perf['getEntriesByType']('resource');
        }
    }
};
/**
 * @constructor
 * @param {!Window} window
 * @param {!Document} document
 */
function BrowserProperties(window, document) {
    /** @type {!Window} */
    this.__window = window;

    /** @type {!Document} */
    this.__document = document;
}

/**
 * @param {string} cookie
 */
BrowserProperties.prototype.setDocumentCookie = function(cookie) {
    this.__document.cookie = cookie;
};

/**
 * @return {string}
 */
BrowserProperties.prototype.getDocumentCookie = function() {
    return this.__document.cookie;
};

/**
 * @param {Function} callback
 * @param {number} timeout
 * @return {number}
 */
BrowserProperties.prototype.cdxSetTimeout = function(callback, timeout) {
    return this.__window['setTimeout'](callback, timeout);
};

/**
 * @param {number} timeoutId
 */
BrowserProperties.prototype.cdxClearTimeout = function(timeoutId) {
    this.__window['clearTimeout'](timeoutId);
};

/**
 * @return {Object}
 */
BrowserProperties.prototype.getPerformanceObject = function() {
    if ('performance' in this.__window) {
        return this.__window['performance'];
    }
    return null;
};

/**
 * @param {string} name
 * @return {PerformanceResourceTiming}
 */
BrowserProperties.prototype.getResourceTimingEntry = function(name) {
    //debugger;
    var perf = this.__window['performance'];
    if (perf) {
        var entries;
        if ('getEntriesByName' in perf) {
            //debugger;
            entries = perf['getEntriesByName'](name);
            if (entries && entries.length) {
                return entries[entries.length - 1];
            }
        }
        if ('getEntriesByType' in perf) {
            entries = perf['getEntriesByType']('resource');
            var i = entries.length;
            while (i--) {
                if (entries[i]['name'] === name) {
                    return entries[i];
                }
            }
        }
    }
    return null;
};

/**
 * @return {string}
 */
BrowserProperties.prototype.getUserAgentString = function() {
    return this.__window.navigator.userAgent;
};

/**
 * @param {!RegExp} regex
 * @return {boolean}
 */
BrowserProperties.prototype.testUserAgentString = function(regex) {
    return regex.test(this.__window.navigator.userAgent);
};

/**
 * @param {!RegExp} regex
 * @return {boolean}
 */
BrowserProperties.prototype.testQueryString = function(regex) {
    return regex.test(this.__window.location.search);
};

/**
 * @param {string} propertyName
 * @param {!Object} initial
 * @param {boolean} overwriteIfPresent
 * @return {!Object}
 */
BrowserProperties.prototype.createWindowObject = function(propertyName, initial, overwriteIfPresent) {
    if (!Object.prototype.hasOwnProperty.call(this.__window, propertyName) || overwriteIfPresent) {
        this.__window[propertyName] = initial;
    }
    return this.__window[propertyName];
};

/**
 * @param {string} url
 * @param {Function=} onLoadCallback
 * @param {Function=} onErrorCallback
 */
BrowserProperties.prototype.insertScript = function(url, onLoadCallback, onErrorCallback) {
    var script = this.__document.createElement('script');
    script['async'] = true;
    script['src'] = url;
    if (onLoadCallback) {
        script['onload'] = onLoadCallback;
    }
    if (onErrorCallback) {
        script['onerror'] = onErrorCallback;
    }
    this.addToContainer(script);
};

/**
 * @param {string} url
 * @param {Function=} onloadHandler
 */
BrowserProperties.prototype.insertIframe = function(url, onloadHandler) {
    var elem = this.__document.createElement('iframe');
    elem['style']['display'] = 'none';
    elem['src'] = url;
    if (onloadHandler) {
        elem.addEventListener('load', onloadHandler, false);
    }
    this.addToContainer(elem);
};

/**
 * @param {!Element} elem
 */
BrowserProperties.prototype.addToContainer = function(elem) {
    var container = this.__document.getElementById('cdx');
    if (!container) {
        container = this.__document.createElement('div');
        container['id'] = 'cdx';
        this.__document.body.appendChild(container);
    }
    container.appendChild(elem);
};

BrowserProperties.prototype.clearCdxDiv = function() {
    var container = this.__document.getElementById('cdx');
    if (container) {
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }
    }
};

/**
 * @return {Object}
 */
BrowserProperties.prototype.getCrypto = function() {
    return this.__window['crypto'] || this.__window['msCrypto'];
};

/**
 * @param {string} tagName
 * @return {!Element}
 */
BrowserProperties.prototype.createElement = function(tagName) {
    return this.__document.createElement(tagName);
};

BrowserProperties.prototype.getDocumentProperty = function(name) {
    return this.__document[name];
};

BrowserProperties.prototype.getWindowProperty = function(name) {
    return this.__window[name];
};

/**
 * @param {string} name
 * @return {string|undefined}
 */
BrowserProperties.prototype.getQueryStringArgument = function(name) {
    var queryString = this.__window.location.search.slice(1);
    if (queryString) {
        var parts = queryString.split('&');
        var i = parts.length;
        while (i--) {
            var pair = parts[i].split('=');
            if (pair[0] === name && pair[1]) {
                return pair[1];
            }
        }
    }
};

/**
 * @return {string}
 */
BrowserProperties.prototype.getPageProtocol = function() {
    return this.__window.location.protocol;
};

BrowserProperties.prototype.clearResourceTimings = function() {
    var perf = this.getPerformanceObject();
    if (perf) {
        var fun = perf['clearResourceTimings'] || perf['webkitClearResourceTimings'];
        if (fun) {
            fun.call(perf);
            //console.log('Resource timing buffer cleared');
        }
    }
};

/**
 * @param {number} maxSize
 */
BrowserProperties.prototype.setResourceTimingBufferSize = function(maxSize) {
    var perf = this.getPerformanceObject();
    if (perf) {
        var fun = perf['setResourceTimingBufferSize'] || perf['webkitSetResourceTimingBufferSize'];
        if (fun) {
            fun.call(perf, maxSize);
            //console.log('Resource timing buffer size set: ' + maxSize);
        }
    }
};
/**
 * @constructor
 * @param {!Object} source
 * @param {!BrowserProperties} browserProperties
 * @param {!SessionProperties} sessionProperties
 */
function Provider(source, browserProperties, sessionProperties) {
    var temp;

    /** @type {boolean} */
    this.__cacheBusting = ('boolean' === typeof source['a']) ? source['a'] : true;

    var providerData = source['p'];

    /** @type {number} */
    this.__zoneId = providerData['z'];

    /** @type {number} */
    this.__customerId = providerData['c'];

    /** @type {number} */
    this.__providerId = providerData['i'];

    /** @type {number} */
    this.__transactionId = sessionProperties.transactionId;

    /** @type {(Probe|null)} */
    this.__currentProbe = null;

    /** @type {function(!ProviderFinishedEvent)} */
    this.__onProviderComplete = sessionProperties.providerComplete;

    /** @type {!Array.<!function(!MeasurementReadyEvent)>} */
    this.__onMeasurementReadyHandlers = [];

    /** @type {(string|null)} */
    this.__cacheNodeId = null;

    /** @type {ProbeFinishedEvent} */
    this.__savedColdProbeFinishedEvent = null;

    /** @type {(ProviderSubstitution|null)} */
    this.__substitutionConfiguration = null;

    if (!!(temp = source['c'])) {
        this.__substitutionConfiguration = {
            zoneId: temp['a'],
            customerId: temp['b'],
            providerId: temp['c']
        };
    }

    /** @type {!Array.<!Probe>} */
    this.__probes = [];
    if ('p' in providerData) {
        var probesData = providerData['p'];
        var onProbeFinishedCallback = this.makeOnProbeFinishedCallback();
        var onCacheNodeIdProbeFinishedCallback = this.makeOnCacheNodeIdProbeFinishedCallback();
        if (probesData['a'] && probesData['a']['a']) {
            // HTTP Cold
            temp = probesData['a']['a'];
        } else if (probesData['b'] && probesData['b']['a']) {
            // HTTPS Cold
            temp = probesData['b']['a'];
        }

        if (temp) {
            this.__probes.push(new ColdProbe(
                sessionProperties,
                {
                    browserProperties: browserProperties,
                    provider: this,
                    resourceType: this.__resourceTypeMap[temp['t']],
                    baseUrl: temp['u'],
                    timeoutInMs: standardSmallObjectTimeout,
                    sendReport: true,
                    isThroughput: false,
                    probeFinished: onProbeFinishedCallback,
                    cacheNodeIdProbeFinished: onCacheNodeIdProbeFinishedCallback
                },
                !!probesData['d']
            ));
        }

        if (!!(temp = probesData['d'])) {
            // Cache node id (UNI)
            this.__probes.push(
                new CacheNodeIdProbe(
                    sessionProperties,
                    {
                        browserProperties: browserProperties,
                        provider: this,
                        resourceType: this.__resourceTypeMap[temp['t']],
                        baseUrl: temp['u'],
                        timeoutInMs: standardSmallObjectTimeout,
                        sendReport: true,
                        isThroughput: false,
                        probeFinished: onProbeFinishedCallback,
                        cacheNodeIdProbeFinished: onCacheNodeIdProbeFinishedCallback
                    }
                )
            );
        }

        /** @type {number} */
        var largeObjectRepeatCount = ('number' === typeof source['b']) ? source['b'] : 1;

        if (probesData['a']) {
            // HTTP
            if (!!(temp = probesData['a']['b'])) {
                this.__probes.push(new RttProbe(
                    sessionProperties,
                    {
                        browserProperties: browserProperties,
                        provider: this,
                        resourceType: this.__resourceTypeMap[temp['t']],
                        baseUrl: temp['u'],
                        timeoutInMs: standardSmallObjectTimeout,
                        sendReport: true,
                        isThroughput: false,
                        probeFinished: onProbeFinishedCallback,
                        cacheNodeIdProbeFinished: function() {}
                    }
                ));
            }
            if (!!(temp = probesData['a']['c'])) {
                this.__addThroughputProbes({
                    browserProperties: browserProperties,
                    resourceType: this.__resourceTypeMap[temp['t']],
                    largeObjectRepeatCount: largeObjectRepeatCount,
                    probeFinished: onProbeFinishedCallback,
                    sessionProperties: sessionProperties,
                    url: temp['u']
                });
            }
        } else if (probesData['b']) {
            // HTTPS
            if (!!(temp = probesData['b']['b'])) {
                this.__probes.push(new RttProbe(
                    sessionProperties,
                    {
                        browserProperties: browserProperties,
                        provider: this,
                        resourceType: this.__resourceTypeMap[temp['t']],
                        baseUrl: temp['u'],
                        timeoutInMs: standardSmallObjectTimeout,
                        sendReport: true,
                        isThroughput: false,
                        probeFinished: onProbeFinishedCallback,
                        cacheNodeIdProbeFinished: function() {}
                    }
                ));
            }
            if (!!(temp = probesData['b']['c'])) {
                this.__addThroughputProbes({
                    browserProperties: browserProperties,
                    resourceType: this.__resourceTypeMap[temp['t']],
                    largeObjectRepeatCount: largeObjectRepeatCount,
                    probeFinished: onProbeFinishedCallback,
                    sessionProperties: sessionProperties,
                    url: temp['u']
                });
            }
        }

        // Custom measurement
        //debugger;
        if (!!(temp = probesData['c'])) {
            var probeProtocol = protocolFromUrl(temp['u']);
            var windowProtocol = window['location']['protocol'];
            if (probeProtocol
                && ('http:' === windowProtocol
                || 'https' === probeProtocol)) {
                this.__probes.push(new CustomProbe(
                    sessionProperties,
                    {
                        browserProperties: browserProperties,
                        provider: this,
                        resourceType: this.__resourceTypeMap[temp['t']],
                        baseUrl: temp['u'],
                        timeoutInMs: standardSmallObjectTimeout,
                        sendReport: true,
                        isThroughput: false,
                        probeFinished: onProbeFinishedCallback,
                        cacheNodeIdProbeFinished: function() {}
                    }
                ));
            }
        }
    }

    //
    /**
     * @param {string} url
     */
    function protocolFromUrl(url) {
        if (/http:/i.test(url)) {
            return 'http';
        }
        if (/https:/i.test(url)) {
            return 'https';
        }
        if (/\/\//.test(url)) {
            return window.location.protocol.replace(':', '');
        }
        return null;
    }
}

/**
 * @param {!function(!MeasurementReadyEvent)} handler
 */
Provider.prototype.addMeasurementReadyHandler = function(handler) {
    this.__onMeasurementReadyHandlers.push(handler);
};

/**
 * @return {(ProviderSubstitution|null)}
 */
Provider.prototype.getSubstitutionConfiguration = function() {
    return this.__substitutionConfiguration;
};

/**
 * @return {!function(!ProbeFinishedEvent)}
 */
Provider.prototype.makeOnProbeFinishedCallback = function() {
    var that = this;
    return function(event) {
        that.onProbeFinished(event);
    };
};

/**
 * @return {!function(!CacheNodeIdProbeFinishedEvent)}
 */
Provider.prototype.makeOnCacheNodeIdProbeFinishedCallback = function() {
    var that = this;
    return function(event) {
        that.onCacheNodeIdProbeFinished(event);
    };
};

Provider.prototype.beginMeasurements = function() {
    this.beginNextMeasurement();
};

/**
 * @param {!ProbeFinishedEvent} event
 */
Provider.prototype.onProbeFinished = function(event) {
    //console.log(event);
    //debugger;
    if (event.getAbortProvider()) {
        // Skip to the next provider
        this.__onProviderComplete(new ProviderFinishedEvent());
    } else {
        // Send report and start the next probe
        /** @type {!Probe} */
        var probe = event.getProbe();
        if (probe.waitForUni) {
            this.saveColdMeasurement(event);
            this.beginNextMeasurement();
        } else {
            this.notifyMeasurementReadySubscribers(
                new MeasurementReadyEvent({
                    provider: this,
                    probeTypeId: probe.getProbeId(),
                    resultCode: event.getResultCode(),
                    value: event.getMeasurement(),
                    sendReport: event.getSendReport()
                }));
            if (0 === event.getResultCode()) {
                this.beginNextMeasurement();
            } else {
                this.__onProviderComplete(new ProviderFinishedEvent());
            }
        }
    }
};

/**
 * @param {!CacheNodeIdProbeFinishedEvent} event
 */
Provider.prototype.onCacheNodeIdProbeFinished = function(event) {
    this.__cacheNodeId = event.cacheNodeId;
    if (this.__savedColdProbeFinishedEvent) {
        this.notifyMeasurementReadySubscribers(new MeasurementReadyEvent({
            provider: this,
            probeTypeId: 1,
            resultCode: this.__savedColdProbeFinishedEvent.getResultCode(),
            value: this.__savedColdProbeFinishedEvent.getMeasurement(),
            sendReport: true
        }));
    }
    this.beginNextMeasurement();
};

/**
 * @param {!ProbeFinishedEvent} event
 */
Provider.prototype.saveColdMeasurement = function(event) {
    this.__savedColdProbeFinishedEvent = event;
};

Provider.prototype.beginNextMeasurement = function() {
    //debugger;
    if (0 < this.__probes.length) {
        // Begin the next probe
        this.__currentProbe = this.__probes.shift();
        this.__currentProbe.beginMeasurement();
    } else {
        this.__onProviderComplete(new ProviderFinishedEvent());
    }
};

/**
 * @param {!MeasurementReadyEvent} event
 */
Provider.prototype.notifyMeasurementReadySubscribers = function(event) {
    //debugger;
    var i = this.__onMeasurementReadyHandlers.length;
    while (i--) {
        this.__onMeasurementReadyHandlers[i](event);
    }
};

/**
 * @param  settings
 */
Provider.prototype.__addThroughputProbes = function(settings) {
    //debugger;
    for (var i = 0; i < settings.largeObjectRepeatCount; i++) {
        this.__probes.push(new LargeObjectProbe(
            settings.sessionProperties,
            {
                browserProperties: settings.browserProperties,
                provider: this,
                resourceType: settings.resourceType,
                baseUrl: settings.url,
                timeoutInMs: standardLargeObjectTimeout,
                sendReport: (i === (settings.largeObjectRepeatCount - 1)),
                isThroughput: true,
                probeFinished: settings.probeFinished,
                cacheNodeIdProbeFinished: function() {}
            },
            i
        ));
    }
};

// /** @type {Object.<string,number>} */
// Provider.prototype.objectTypeMap = {
//     'CEDEXISTESTOBJECT': 1,
//     'CUSTOMIMAGEFILE': 2,
//     'CUSTOMPAGE': 3,
//     'DNS': 9,
//     'DSA': 4,
//     'CUSTOMJAVASCRIPTFILE': 5,
//     'AUTODETECT': 6,
//     'ajax': 7,
//     'jsonp': 8
// };

/**
 * @type {!Object.<number, string>}
 */
Provider.prototype.__resourceTypeMap = {
    1: 'script',
    2: 'image',
    3: 'html;custom',
    4: 'html;dsa',
    5: 'script;other',
    6: 'auto',
    7: 'uni;ajax',
    8: 'uni;jsonp',
    9: 'image;dns'
};

/**
 * @return {number}
 */
Provider.prototype.getZoneId = function() {
    return this.__zoneId;
};

/**
 * @return {number}
 */
Provider.prototype.getCustomerId = function() {
    return this.__customerId;
};

/**
 * @return {number}
 */
Provider.prototype.getProviderId = function() {
    return this.__providerId;
};

/**
 * @return {number}
 */
Provider.prototype.getTransactionId = function() {
    return this.__transactionId;
};

/**
 * @return boolean
 */
Provider.prototype.getCacheBusting = function() {
    return this.__cacheBusting;
};

/**
 * @return {(string|null)}
 */
Provider.prototype.getCacheNodeId = function() {
    return this.__cacheNodeId;
};

/**
 * @param {*} data
 */
Provider.prototype.processWindowMessageData = function(data) {
    // Validate that the incoming message applies to the currently active
    // provider and probe
    //debugger;
    if (this.__currentProbe
        && this.__currentProbe.processWindowMessageData
        && data['p']
        && data['r']) {
        if (data['p']['z'] == this.__zoneId
            && data['p']['c'] == this.__customerId
            && data['p']['i'] == this.__providerId) {
            this.__currentProbe.processWindowMessageData(data);
        }
    }
};
/**
 * @constructor
 * @implements {Probe}
 * @param {!SessionProperties} sessionProperties
 * @param {!ProbeSettings} probeSettings
 * @param {boolean} waitForUni
 */
function ColdProbe(sessionProperties, probeSettings, waitForUni) {
    /** @type {!Provider} */
    this.__provider = probeSettings.provider;

    /** @type {number} */
    this.__transactionId = sessionProperties.transactionId;

    /** @type {boolean} */
    this.waitForUni = waitForUni;

    /** @type {!ProbeBehavior} */
    this.__behavior = createProbeBehavior(
        this,
        sessionProperties,
        probeSettings
    );

    /** @type {boolean} */
    this.__cancelled = false;
}

/**
 * @return {!Provider}
 */
ColdProbe.prototype.getProvider = function() {
    return this.__provider;
};

/**
 * @return {number}
 */
ColdProbe.prototype.getProbeId = function() {
    return 1;
};

/**
 * @return {string}
 */
ColdProbe.prototype.getProbeIdAsString = function() {
    return this.getProbeId().toString();
};

/**
 * @return {string}
 */
ColdProbe.prototype.getQueryStringProbeId = function() {
    return '' + this.getProbeId();
};

ColdProbe.prototype.beginMeasurement = function() {
    this.__behavior.execute();
};

ColdProbe.prototype.cdxClearTimeout = function() {
    this.__behavior.cdxClearTimeout();
};

/**
 * @param {*} data
 */
ColdProbe.prototype.processWindowMessageData = function(data) {
    this.__behavior.processWindowMessageData(data);
};

/**
 * @param {boolean} value
 */
ColdProbe.prototype.setCancelled = function(value) {
    this.__cancelled = value;
};

/**
 * @return {boolean}
 */
ColdProbe.prototype.getCancelled = function() {
    return this.__cancelled;
};
/**
 * @constructor
 * @implements {Probe}
 * @param {SessionProperties} sessionProperties
 * @param {ProbeSettings} probeSettings
 */
function CacheNodeIdProbe(sessionProperties, probeSettings) {
    /** @type {!Provider} */
    this.__provider = probeSettings.provider;

    /** @type {!ProbeBehavior} */
    this.__behavior = createCacheNodeIdDetectionBehavior(
        this,
        sessionProperties,
        probeSettings
    );

    /** @type {boolean} */
    this.__cancelled = false;
}

/**
 * @return {!Provider}
 */
CacheNodeIdProbe.prototype.getProvider = function() {
    return this.__provider;
};

CacheNodeIdProbe.prototype.getProbeId = function() {
    throw notImplemented('CacheNodeIdProbe.prototype.getProbeId');
};

/**
 * @return {string}
 */
CacheNodeIdProbe.prototype.getProbeIdAsString = function() {
    return 'uni';
};

/**
 * @param {*} data
 */
CacheNodeIdProbe.prototype.processWindowMessageData = function(data) {
    this.__behavior.processWindowMessageData(data);
};

/**
 * @return {string}
 */
CacheNodeIdProbe.prototype.getQueryStringProbeId = function() {
    return 'uni';
};

CacheNodeIdProbe.prototype.beginMeasurement = function() {
    this.__behavior.execute();
};

CacheNodeIdProbe.prototype.cdxClearTimeout = function() {
    //debugger;
    this.__behavior.cdxClearTimeout();
};

/**
 * @param {boolean} value
 */
CacheNodeIdProbe.prototype.setCancelled = function(value) {
    this.__cancelled = value;
};

/**
 * @return {boolean}
 */
CacheNodeIdProbe.prototype.getCancelled = function() {
    return this.__cancelled;
};
/**
 * @constructor
 * @implements {Probe}
 * @param {!SessionProperties} sessionProperties
 * @param {!ProbeSettings} probeSettings
 * @param {number} repeatIndex
 */
function LargeObjectProbe(sessionProperties, probeSettings, repeatIndex) {

    /** @type {!Provider} */
    this.__provider = probeSettings.provider;

    /** @type {number} */
    this.__repeatIndex = repeatIndex;

    /** @type {!ProbeBehavior} */
    this.__behavior = createProbeBehavior(
        this,
        sessionProperties,
        probeSettings
    );

    /** @type {boolean} */
    this.__isThroughput = true;

    /** @type {boolean} */
    this.__cancelled = false;
}

/**
 * @return {!Provider}
 */
LargeObjectProbe.prototype.getProvider = function() {
    return this.__provider;
};

/**
 * @return {number}
 */
LargeObjectProbe.prototype.getProbeId = function() {
    return 14;
};

/**
 * @return {string}
 */
LargeObjectProbe.prototype.getProbeIdAsString = function() {
    return this.getProbeId().toString();
};

/**
 * @return {string}
 */
LargeObjectProbe.prototype.probeSuffixFromIndex = function() {
    if (0 === this.__repeatIndex) {
        return '';
    }
    return String.fromCharCode(97 + this.__repeatIndex);
};

/**
 * @return {string}
 */
LargeObjectProbe.prototype.getQueryStringProbeId = function() {
    return this.getProbeId() + this.probeSuffixFromIndex();
};

LargeObjectProbe.prototype.beginMeasurement = function() {
    this.__behavior.execute();
};

LargeObjectProbe.prototype.cdxClearTimeout = function() {
    this.__behavior.cdxClearTimeout();
};

LargeObjectProbe.prototype.processWindowMessageData = function() {};

/**
 * @param {boolean} value
 */
LargeObjectProbe.prototype.setCancelled = function(value) {
    this.__cancelled = value;
};

/**
 * @return {boolean}
 */
LargeObjectProbe.prototype.getCancelled = function() {
    return this.__cancelled;
};
/**
 * @constructor
 * @implements {Probe}
 * @param {!SessionProperties} sessionProperties
 * @param {!ProbeSettings} probeSettings
 */
function RttProbe(sessionProperties, probeSettings) {
    /** @type {!Provider} */
    this.__provider = probeSettings.provider;

    /** @type {!ProbeBehavior} */
    this.__behavior = createProbeBehavior(
        this,
        sessionProperties,
        probeSettings
    );

    /** @type {boolean} */
    this.__cancelled = false;
}

/**
 * @return {!Provider}
 */
RttProbe.prototype.getProvider = function() {
    return this.__provider;
};

/**
 * @return {number}
 */
RttProbe.prototype.getProbeId = function() {
    return 0;
};

/**
 * @return {string}
 */
RttProbe.prototype.getProbeIdAsString = function() {
    return this.getProbeId().toString();
};

/**
 * @return {string}
 */
RttProbe.prototype.getQueryStringProbeId = function() {
    return '' + this.getProbeId();
};

RttProbe.prototype.beginMeasurement = function() {
    this.__behavior.execute();
};

RttProbe.prototype.cdxClearTimeout = function() {
    this.__behavior.cdxClearTimeout();
};

/**
 * @param {*} data
 */
RttProbe.prototype.processWindowMessageData = function(data) {
    this.__behavior.processWindowMessageData(data);
};

/**
 * @param {boolean} value
 */
RttProbe.prototype.setCancelled = function(value) {
    this.__cancelled = value;
};

/**
 * @return {boolean}
 */
RttProbe.prototype.getCancelled = function() {
    return this.__cancelled;
};
/**
 * @constructor
 * @implements {Probe}
 * @param {!SessionProperties} sessionProperties
 * @param {!ProbeSettings} probeSettings
 */
function CustomProbe(sessionProperties, probeSettings) {
    /** @type {!Provider} */
    this.__provider = probeSettings.provider;

    /** @type {!ProbeBehavior} */
    this.__behavior = createProbeBehavior(
        this,
        sessionProperties,
        probeSettings
    );

    /** @type {boolean} */
    this.__cancelled = false;
}

/**
 * @return {number}
 */
CustomProbe.prototype.getProbeId = function() {
    return 2;
};

/**
 * @return {string}
 */
CustomProbe.prototype.getProbeIdAsString = function() {
    return this.getProbeId().toString();
};

/**
 * @return {!Provider}
 */
CustomProbe.prototype.getProvider = function() {
    return this.__provider;
};

/**
 * @return {string}
 */
CustomProbe.prototype.getQueryStringProbeId = function() {
    return '' + this.getProbeId();
};

CustomProbe.prototype.beginMeasurement = function() {
    this.__behavior.execute();
};

CustomProbe.prototype.cdxClearTimeout = function() {
    this.__behavior.cdxClearTimeout();
};

CustomProbe.prototype.processWindowMessageData = function() {};

/**
 * @param {boolean} value
 */
CustomProbe.prototype.setCancelled = function(value) {
    this.__cancelled = value;
};

/**
 * @return {boolean}
 */
CustomProbe.prototype.getCancelled = function() {
    return this.__cancelled;
};
/**
 * @constructor
 * @implements {Probe}
 * @param {!SessionProperties} sessionProperties
 * @param {!ProbeSettings} probeSettings
 */
function RttProbe(sessionProperties, probeSettings) {
    /** @type {!Provider} */
    this.__provider = probeSettings.provider;

    /** @type {!ProbeBehavior} */
    this.__behavior = createProbeBehavior(
        this,
        sessionProperties,
        probeSettings
    );

    /** @type {boolean} */
    this.__cancelled = false;
}

/**
 * @return {!Provider}
 */
RttProbe.prototype.getProvider = function() {
    return this.__provider;
};

/**
 * @return {number}
 */
RttProbe.prototype.getProbeId = function() {
    return 0;
};

/**
 * @return {string}
 */
RttProbe.prototype.getProbeIdAsString = function() {
    return this.getProbeId().toString();
};

/**
 * @return {string}
 */
RttProbe.prototype.getQueryStringProbeId = function() {
    return '' + this.getProbeId();
};

RttProbe.prototype.beginMeasurement = function() {
    this.__behavior.execute();
};

RttProbe.prototype.cdxClearTimeout = function() {
    this.__behavior.cdxClearTimeout();
};

/**
 * @param {*} data
 */
RttProbe.prototype.processWindowMessageData = function(data) {
    this.__behavior.processWindowMessageData(data);
};

/**
 * @param {boolean} value
 */
RttProbe.prototype.setCancelled = function(value) {
    this.__cancelled = value;
};

/**
 * @return {boolean}
 */
RttProbe.prototype.getCancelled = function() {
    return this.__cancelled;
};
/**
 * @constructor
 * @implements {ProbeBehavior}
 * @param {ProbeSettings} probeSettings
 * @param {string} url
 * @param {!Probe} probe
 */
function ScriptProbeBehavior(probeSettings, url, probe) {
    /** @type {!BrowserProperties} */
    this.__browserProperties = probeSettings.browserProperties;

    /** @type {!Probe} */
    this.__probe = probe;

    /** @type {string} */
    this.__url = url;

    /** @type {string} */
    this.__baseUrl = probeSettings.baseUrl;

    /** @type {boolean} */
    this.__cancelled = false;

    /** @type {string|null} */
    this.__status = null;

    /** @type {number} */
    this.__timeoutInMs = probeSettings.timeoutInMs;

    /** @type {number} */
    this.__timeoutId = 0;

    /** @type {function(!ProbeFinishedEvent)} */
    this.__onComplete = probeSettings.probeFinished;

    /** @type {number|null} */
    this.__startTime = null;
}

ScriptProbeBehavior.prototype.setCancelled = function() {
    this.__cancelled = true;
};

/**
 * @param {string} value
 */
ScriptProbeBehavior.prototype.setStatus = function(value) {
    this.__status = value;
};

ScriptProbeBehavior.prototype.execute = function() {
    //debugger;
    this.__status = 'loading';
    this.__browserProperties.insertScript(
        this.__url,
        this.makeScriptOnLoadCallback(),
        this.makeScriptOnErrorCallback()
    );
    this.__startTime = (new Date()).getTime();
    this.__timeoutId = this.__browserProperties.cdxSetTimeout(
        this.makeTimeoutCallback(),
        this.__timeoutInMs
    );
};

ScriptProbeBehavior.prototype.makeScriptOnLoadCallback = function() {
    var that = this;
    return function() {
        that.cdxClearTimeout();
        that.onScriptLoaded();
    };
};

ScriptProbeBehavior.prototype.makeScriptOnErrorCallback = function() {
    var that = this;
    return function() {
        that.cdxClearTimeout();
        that.setCancelled();
        that.onScriptError();
    };
};

ScriptProbeBehavior.prototype.makeTimeoutCallback = function() {
    var that = this;
    return function() {
        that.setCancelled();
        that.onScriptTimeout();
    };
};

ScriptProbeBehavior.prototype.onScriptLoaded = function() {
    var interval = (new Date()).getTime() - this.__startTime;
    //console.log('Elapsed: ' + interval);
    if (!this.__cancelled) {
        var measurement = interval;
        if (this.__probe.__isThroughput) {
            measurement = measurementFromInterval(interval, this.__baseUrl);
        }
        if (1 > measurement) {
            // Invalid measurement
            this.__onComplete(createProbeFinishedEvent(this.__probe, null, null, true, true));
        } else if (interval <= this.__timeoutInMs) {
            // Valid measurement
            this.__onComplete(createProbeFinishedEvent(this.__probe, 0, measurement, false, true));
        } else {
            // Timeout
            this.__onComplete(createProbeFinishedEvent(this.__probe, 1, 0, false, true));
        }
    }
};

ScriptProbeBehavior.prototype.onScriptError = function() {
    // Clear the timeout right away
    this.cdxClearTimeout();
    this.setCancelled();
    this.setStatus('error');
    //debugger;
    this.__onComplete(createProbeFinishedEvent(this.__probe, 4, 0, false, true));
};

ScriptProbeBehavior.prototype.onScriptTimeout = function() {
    this.setCancelled();
    this.__onComplete(createProbeFinishedEvent(this.__probe, 1, 0, false, true));
};

ScriptProbeBehavior.prototype.cdxClearTimeout = function() {
    // Clear the timeout right away
    this.__browserProperties.cdxClearTimeout(this.__timeoutId);
};

ScriptProbeBehavior.prototype.processWindowMessageData = function() {};
/**
 * @constructor
 * @implements {ProbeBehavior}
 * @param {!ProbeSettings} probeSettings
 * @param {string} url
 * @param {!Probe} probe
 */
function ImageProbeBehavior(probeSettings, url, probe) {
    /** @type {!BrowserProperties} */
    this.__browserProperties = probeSettings.browserProperties;

    /** @type {!Probe} */
    this.__probe = probe;

    /** @type {string} */
    this.__url = url;

    /** @type {string} */
    this.__baseUrl = probeSettings.baseUrl;

    /** @type {boolean} */
    this.__cancelled = false;

    /** @type {string|null} */
    this.__status = null;

    /** @type {number} */
    this.__timeoutInMs = probeSettings.timeoutInMs;

    /** @type {number} */
    this.__timeoutId = 0;

    /** @type {boolean} */
    this.__sendReport = probeSettings.sendReport;

    /** @type {function(!ProbeFinishedEvent)} */
    this.__onComplete = probeSettings.probeFinished;
}

ImageProbeBehavior.prototype.setCancelled = function() {
    this.__cancelled = true;
};

/**
 * @param {string} value
 */
ImageProbeBehavior.prototype.setStatus = function(value) {
    this.__status = value;
};

/**
 * @param {number} value
 */
ImageProbeBehavior.prototype.setTimeoutId = function(value) {
    this.__timeoutId = value;
};

ImageProbeBehavior.prototype.execute = function() {
    var performance = this.__browserProperties.getPerformanceObject();
    if (performance && 'getEntriesByType' in performance) {
        var image = new Image();
        image.onload = this.makeOnloadCallback();
        var onErrorCallback = this.makeOnerrorCallback();
        if (image.addEventListenter) {
            image.addEventListenter('error', onErrorCallback);
        } else {
            image.onerror = onErrorCallback;
        }
        this.setStatus('loading');
        this.setTimeoutId(this.__browserProperties.cdxSetTimeout(
            this.makeTimeoutCallback(),
            this.__timeoutInMs
        ));
        // This initiates the download
        image.src = this.__url;
    } else {
        // Skip this probe because the user agent doesn't support Resource Timing
        this.__onComplete(createProbeFinishedEvent(this.__probe, null, null, false, this.__sendReport));
    }
};

/**
 * @return {Function}
 */
ImageProbeBehavior.prototype.makeTimeoutCallback = function() {
    var that = this;
    return function() {
        // Report a timeout
        that.setCancelled();
        that.__onComplete(createProbeFinishedEvent(that.__probe, 1, 0, false, that.__sendReport));
    };
};

/**
 * @param {Image} image
 */
ImageProbeBehavior.prototype.onImageLoad = function(image) {
    // Clear the timeout right away
    this.cdxClearTimeout();
    if (!this.__cancelled) {
        //debugger;
        if (this.__sendReport) {
            /** @type {PerformanceResourceTiming} */
            var resource = this.__browserProperties.getResourceTimingEntry(image['src']);
            if (resource) {
                var interval;
                var probe = this.__probe;
                //debugger;
                if (0 < resource.requestStart) {
                    if (probe.__isThroughput) {
                        interval = Math.round(resource.responseEnd - resource.requestStart);
                    } else {
                        interval = Math.round(resource.responseStart - resource.requestStart);
                    }
                } else {
                    interval = Math.round(resource.duration);
                }

                //debugger;
                var measurement = interval;
                if (probe.__isThroughput) {
                    measurement = measurementFromInterval(interval, this.__baseUrl);
                }
                if (1 > measurement) {
                    // Invalid measurement
                    this.__onComplete(createProbeFinishedEvent(this.__probe, null, null, true, this.__sendReport));
                } else if (interval <= this.__timeoutInMs) {
                    // Valid measurement
                    //debugger;
                    this.__onComplete(createProbeFinishedEvent(this.__probe, 0, measurement, false, this.__sendReport));
                } else {
                    // Timeout
                    this.__onComplete(createProbeFinishedEvent(this.__probe, 1, 0, false, this.__sendReport));
                }
            } else {
                //console.log('Resource timing object not found');
                this.__onComplete(createProbeFinishedEvent(this.__probe, null, null, true, false));
            }
        } else {
            // Generally part of a multi-download measurement (e.g. multiple large object download)
            this.__onComplete(createProbeFinishedEvent(this.__probe, null, null, false, this.__sendReport));
        }
    }
};

/**
 * @return {Function}
 */
ImageProbeBehavior.prototype.makeOnloadCallback = function() {
    var that = this;
    return function() {
        that.onImageLoad(this);
    };
};

/**
 * @return {Function}
 */
ImageProbeBehavior.prototype.makeOnerrorCallback = function() {
    var that = this;
    return function() {
        that.onError();
    };
};

ImageProbeBehavior.prototype.onError = function() {
    // Clear the timeout right away
    this.cdxClearTimeout();
    this.setCancelled();
    this.setStatus('error');
    this.__onComplete(createProbeFinishedEvent(this.__probe, 4, 0, false, this.__sendReport));
};

ImageProbeBehavior.prototype.cdxClearTimeout = function() {
    this.__browserProperties.cdxClearTimeout(this.__timeoutId);
};

ImageProbeBehavior.prototype.processWindowMessageData = function() {};
/**
 * @constructor
 * @implements {ProbeBehavior}
 * @param {!ProbeSettings} probeSettings
 * @param {string} url
 * @param {!Probe} probe
 * @param {!SessionProperties} sessionProperties
 */
function AjaxUniProbeBehavior(probeSettings, url, probe, sessionProperties) {
    /** @type {!BrowserProperties} */
    this.__browserProperties = probeSettings.browserProperties;

    /** @type {string} */
    this.__url = url;

    /** @type {!Probe} */
    this.__probe = probe;

    /** @type {number} */
    this.__timeoutInMs = probeSettings.timeoutInMs;

    /** @type {number} */
    this.__timeoutId = 0;

    /** @type {string|null} */
    this.__status = null;

    /** @type {function(!CacheNodeIdProbeFinishedEvent)} */
    this.__onComplete = probeSettings.cacheNodeIdProbeFinished;

    /** @type {function(number):boolean} */
    this.__transactionComparator = sessionProperties.transactionComparator;
}

/**
 * @param {string} value
 */
AjaxUniProbeBehavior.prototype.setStatus = function(value) {
    this.__status = value;
};

/**
 * @return {string|null}
 */
AjaxUniProbeBehavior.prototype.getStatus = function() {
    return this.__status;
};

AjaxUniProbeBehavior.prototype.execute = function() {
    //debugger;
    if (this.browserHasAjaxUniSupport()) {
        this.__browserProperties.insertIframe(this.__url);
        this.__timeoutId = this.__browserProperties.cdxSetTimeout(
            this.makeTimeoutCallback(),
            this.__timeoutInMs
        );
    } else {
        this.__onComplete(new CacheNodeIdProbeFinishedEvent({
            probe: this.__probe,
            cacheNodeId: '1'
        }));
    }
};

/**
 * @return {Function}
 */
AjaxUniProbeBehavior.prototype.makeTimeoutCallback = function() {
    var that = this;
    return function() {
        //console.log("AJAX UNI timeout detected");
        //debugger;
        if (that.__transactionComparator(that.__probe.getProvider().getTransactionId())
            && !that.__probe.getCancelled()) {
            //console.log('Behavior status: ' + that.getStatus());
            that.__probe.setCancelled(true);
            // Need to make sure that the current probe is still active
            that.__onComplete(new CacheNodeIdProbeFinishedEvent({
                probe: that.__probe,
                cacheNodeId: '2'
            }));
        }
        // else if (!that.__transactionComparator(that.__probe.getProvider().getTransactionId())) {
        //     console.log('Wrong transaction id');
        // }
        // else if (that.__probe.getCancelled()) {
        //     console.log('JSONP UNI probe cancelled');
        // }
    };
};

/**
 * @param {*} data
 */
AjaxUniProbeBehavior.prototype.processWindowMessageData = function(data) {
    switch (data['s']) {
        case 'l':
            this.cdxClearTimeout();
            this.setStatus('loaded');
            //debugger;
            break;
        case 'e':
        case 's':
            //debugger;
            var cacheNodeId = '2';
            if ('e' === data['s']) {
                this.setStatus('error');
            } else {
                cacheNodeId = data['node_id'];
            }
            this.__onComplete(new CacheNodeIdProbeFinishedEvent({
                probe: this.__probe,
                cacheNodeId: cacheNodeId
            }));
            break;
    }
};

AjaxUniProbeBehavior.prototype.cdxClearTimeout = function() {
    this.__browserProperties.cdxClearTimeout(this.__timeoutId);
};

/**
 * @return {boolean}
 */
AjaxUniProbeBehavior.prototype.browserHasAjaxUniSupport = function() {
    if (this.__browserProperties.testQueryString(/radar-no-ajax/)) {
        return false;
    }
    return isFunction(this.__browserProperties.getWindowProperty('postMessage'))
        && isFunction(this.__browserProperties.getWindowProperty('addEventListener'));
};
/**
 * @constructor
 * @implements {ProbeBehavior}
 * @param {!ProbeSettings} probeSettings
 * @param {string} url
 * @param {!Probe} probe
 * @param {!SessionProperties} sessionProperties
 */
function JsonpUniProbeBehavior(probeSettings, url, probe, sessionProperties) {
    /** @type {!BrowserProperties} */
    this.__browserProperties = probeSettings.browserProperties;

    /** @type {string} */
    this.__url = url;

    /** @type {!Probe} */
    this.__probe = probe;

    /** @type {number} */
    this.__timeoutInMs = probeSettings.timeoutInMs;

    /** @type {number} */
    this.__timeoutId = 0;

    /** @type {function(!CacheNodeIdProbeFinishedEvent)} */
    this.__onComplete = probeSettings.cacheNodeIdProbeFinished;

    /** @type {function(number):boolean} */
    this.__transactionComparator = sessionProperties.transactionComparator;
}

JsonpUniProbeBehavior.prototype.execute = function() {
    //debugger;
    var cdx = this.__browserProperties.createWindowObject('cdx', {}, false);
    cdx['s'] = cdx['s'] || {};
    cdx['s']['b'] = this.makeUniJsonpCallback();
    this.__browserProperties.insertScript(this.__url, null, this.makeOnErrorCallback());
    this.__timeoutId = this.__browserProperties.cdxSetTimeout(
        this.makeOnTimeoutCallback(),
        this.__timeoutInMs
    );
};

/**
 * @return {!Function}
 */
JsonpUniProbeBehavior.prototype.makeUniJsonpCallback = function() {
    var that = this;
    //debugger;
    return function(data) {
        //console.log("JSONP UNI callbck");
        //debugger;
        if (data['id'] == that.__probe.getProvider().getProviderId()
            && that.__transactionComparator(that.__probe.getProvider().getTransactionId())
            && !that.__probe.getCancelled()) {
            that.cdxClearTimeout();
            //debugger;
            that.__onComplete(new CacheNodeIdProbeFinishedEvent({
                probe: that.__probe,
                cacheNodeId: data['node']
            }));
        }
        // else if (data['id'] != that.__probe.getProvider().getProviderId()) {
        //     console.log('Wrong provider id');
        // }
        // else if (!that.__transactionComparator(that.__probe.getProvider().getTransactionId())) {
        //     console.log('Wrong transaction id');
        // }
        // else if (that.__probe.getCancelled()) {
        //     console.log('JSONP UNI probe cancelled');
        // }
    };
};

/**
 * @return {!Function}
 */
JsonpUniProbeBehavior.prototype.makeOnTimeoutCallback = function() {
    var that = this;
    return function() {
        //console.log("JSONP UNI timeout detected");
        //debugger;
        if (that.__transactionComparator(that.__probe.getProvider().getTransactionId())
            && !that.__probe.getCancelled()) {
            that.__probe.setCancelled(true);
            // Need to make sure that the current probe is still active
            that.__onComplete(new CacheNodeIdProbeFinishedEvent({
                probe: that.__probe,
                cacheNodeId: '2'
            }));
        }
        // else if (!that.__transactionComparator(that.__probe.getProvider().getTransactionId())) {
        //     console.log('Wrong transaction id');
        // }
        // else if (that.__probe.getCancelled()) {
        //     console.log('JSONP UNI probe cancelled');
        // }
    };
};

JsonpUniProbeBehavior.prototype.makeOnErrorCallback = function() {
    var that = this;
    return function() {
        //console.log('JSONP UNI error detected');
        that.cdxClearTimeout();
        that.__probe.setCancelled(true);
        // Need to make sure that the current probe is still active
        that.__onComplete(new CacheNodeIdProbeFinishedEvent({
            probe: that.__probe,
            cacheNodeId: '2'
        }));
    };
};

JsonpUniProbeBehavior.prototype.cdxClearTimeout = function() {
    this.__browserProperties.cdxClearTimeout(this.__timeoutId);
};

JsonpUniProbeBehavior.prototype.processWindowMessageData = function() {};
/**
 * @constructor
 * @implements {ProbeBehavior}
 * @param {!ProbeSettings} probeSettings
 * @param {string} url
 * @param {!Probe} probe
 */
function DynamicPageProbeBehavior(probeSettings, url, probe) {
    /** @type {!BrowserProperties} */
    this.__browserProperties = probeSettings.browserProperties;

    /** @type {!Probe} */
    this.__probe = probe;

    /** @type {string} */
    this.__url = url;

    /** @type {boolean} */
    this.__cancelled = false;

    /** @type {string|null} */
    this.__status = null;

    /** @type {number} */
    this.__timeoutInMs = probeSettings.timeoutInMs;

    /** @type {number} */
    this.__timeoutId = 0;

    /** @type {function(!ProbeFinishedEvent)} */
    this.__onComplete = probeSettings.probeFinished;
}

DynamicPageProbeBehavior.prototype.setCancelled = function() {
    this.__cancelled = true;
};

/**
 * @param {string} value
 */
DynamicPageProbeBehavior.prototype.setStatus = function(value) {
    this.__status = value;
};

/**
 * @param {number} value
 */
DynamicPageProbeBehavior.prototype.setTimeoutId = function(value) {
    this.__timeoutId = value;
};

DynamicPageProbeBehavior.prototype.execute = function() {
    //debugger;
    this.__browserProperties.insertIframe(
        this.__url,
        null
    );
    this.setStatus('loading');
    this.setTimeoutId(this.__browserProperties.cdxSetTimeout(
        this.makeTimeoutCallback(),
        this.__timeoutInMs
    ));
};

/**
 * @return {Function}
 */
DynamicPageProbeBehavior.prototype.makeTimeoutCallback = function() {
    var that = this;
    return function() {
        // Report a timeout
        that.setCancelled();
        //console.log('DSA timeout detected');
        that.__onComplete(new ProbeFinishedEvent({
            probe: that.__probe,
            resultCode: 1,
            measurement: 0,
            abortProvider: false,
            sendReport: true
        }));
    };
};

DynamicPageProbeBehavior.prototype.cdxClearTimeout = function() {
    this.__browserProperties.cdxClearTimeout(this.__timeoutId);
};

/**
 * @param {*} data
 */
DynamicPageProbeBehavior.prototype.processWindowMessageData = function(data) {
    //debugger;
    if ('l' === data['s']) {
        this.cdxClearTimeout();
        //debugger;
        this.setStatus('loaded');
    } else if ('s' === data['s'] && data['m'] && !this.__cancelled) {
        //debugger;
        /** @type {number} */
        var interval = data['m']['responseEnd'] - data['m']['domainLookupStart'];
        //debugger;
        if (1 > interval) {
            // Invalid measurement
            this.__onComplete(createProbeFinishedEvent(this.__probe, null, null, true, true));
        } else if (interval <= this.__timeoutInMs) {
            // Valid measurement
            this.__onComplete(createProbeFinishedEvent(this.__probe, 0, interval, false, true));
        } else {
            // Timeout
            this.__onComplete(createProbeFinishedEvent(this.__probe, 1, 0, false, true));
        }
    }
};
/**
 * @constructor
 * @implements {ProbeBehavior}
 * @param {!ProbeSettings} probeSettings
 * @param {string} url
 * @param {!Probe} probe
 */
function DnsProbeBehavior(probeSettings, url, probe) {
    /** @type {!BrowserProperties} */
    this.__browserProperties = probeSettings.browserProperties;

    /** @type {!Probe} */
    this.__probe = probe;

    /** @type {string} */
    this.__url = url;

    /** @type {string} */
    this.__baseUrl = probeSettings.baseUrl;

    /** @type {string|null} */
    this.__status = null;

    /** @type {number} */
    this.__timeoutInMs = probeSettings.timeoutInMs;

    /** @type {number} */
    this.__timeoutId = 0;

    /** @type {boolean} */
    this.__sendReport = probeSettings.sendReport;

    /** @type {function(!ProbeFinishedEvent)} */
    this.__onComplete = probeSettings.probeFinished;
}

/**
 * @param {string} value
 */
DnsProbeBehavior.prototype.setStatus = function(value) {
    this.__status = value;
};

/**
 * @param {number} value
 */
DnsProbeBehavior.prototype.setTimeoutId = function(value) {
    this.__timeoutId = value;
};

DnsProbeBehavior.prototype.execute = function() {
    //debugger;
    var performance = this.__browserProperties.getPerformanceObject();
    if (performance && 'getEntriesByType' in performance) {
        var image = new Image();
        //debugger;
        image.addEventListener('load', this.makeOnloadCallback());
        image.addEventListener('error', this.makeOnerrorCallback());
        this.setStatus('loading');
        this.setTimeoutId(this.__browserProperties.cdxSetTimeout(
            this.makeTimeoutCallback(),
            this.__timeoutInMs
        ));
        // This initiates the download
        image.src = this.__url;
    } else {
        // Skip this probe because the user agent doesn't support Resource Timing
        this.__onComplete(createProbeFinishedEvent(this.__probe, null, null, false, this.__sendReport));
    }
};

/**
 * @return {Function}
 */
DnsProbeBehavior.prototype.makeTimeoutCallback = function() {
    var that = this;
    return function() {
        //console.log('DNS timeout detected');
        //debugger;
        if (!that.__probe.getCancelled()) {
            // Report a timeout
            that.__probe.setCancelled(true);
            that.__onComplete(createProbeFinishedEvent(that.__probe, 1, 0, false, that.__sendReport));
        }
    };
};

/**
 * @param {Image} image
 */
DnsProbeBehavior.prototype.onImageLoad = function(image) {
    // Clear the timeout right away
    this.cdxClearTimeout();
    //console.log('DNS load detected');
    //debugger;
    if (!this.__probe.getCancelled()) {
        /** @type {PerformanceResourceTiming} */
        var resource = this.__browserProperties.getResourceTimingEntry(image['src']);
        if (resource) {
            //debugger;
            var interval;
            if (0 < resource.requestStart) {
                interval = Math.round(resource.domainLookupEnd - resource.domainLookupStart);
            } else {
                interval = Math.round(resource.duration);
            }

            if (10 > interval) {
                // Invalid measurement
                this.__onComplete(createProbeFinishedEvent(this.__probe, null, null, true, this.__sendReport));
            } else if (interval <= this.__timeoutInMs) {
                // Valid measurement
                this.__onComplete(createProbeFinishedEvent(this.__probe, 0, interval, false, this.__sendReport));
            } else {
                // Timeout
                this.__onComplete(createProbeFinishedEvent(this.__probe, 1, 0, false, this.__sendReport));
            }
        } else {
            //console.log('Resource timing object not found');
            this.__onComplete(createProbeFinishedEvent(this.__probe, null, null, true, false));
        }
    }
};

DnsProbeBehavior.prototype.onError = function() {
    if (!this.__probe.getCancelled()) {
        this.cdxClearTimeout();
        //console.log('DNS error detected');
        //debugger;
        this.__probe.setCancelled(true);
        this.setStatus('error');
        this.__onComplete(createProbeFinishedEvent(this.__probe, 4, 0, false, this.__sendReport));
    }
};

/**
 * @return {Function}
 */
DnsProbeBehavior.prototype.makeOnloadCallback = function() {
    var that = this;
    return function() {
        that.onImageLoad(this);
    };
};

/**
 * @return {Function}
 */
DnsProbeBehavior.prototype.makeOnerrorCallback = function() {
    var that = this;
    return function() {
        that.onError();
    };
};

DnsProbeBehavior.prototype.cdxClearTimeout = function() {
    this.__browserProperties.cdxClearTimeout(this.__timeoutId);
};

DnsProbeBehavior.prototype.processWindowMessageData = function() {};
/**
 * @constructor
 * @implements {ProbeBehavior}
 * @param {ProbeSettings} probeSettings
 * @param {!Probe} probe
 */
function NoopProbeBehavior(probeSettings, probe) {
    /** @type {!Probe} */
    this.__probe = probe;

    /** @type {function(!ProbeFinishedEvent)} */
    this.__onComplete = probeSettings.probeFinished;
}

NoopProbeBehavior.prototype.cdxClearTimeout = function() {};

NoopProbeBehavior.prototype.processWindowMessageData = function() {};

NoopProbeBehavior.prototype.execute = function() {
    this.__onComplete(createProbeFinishedEvent(this.__probe, null, null, true, true));
};
/**
 * @constructor
 * @implements {RadarEvent}
 * @param  settings
 */
function ProbeFinishedEvent(settings) {
    /** @type {!Probe} */
    this.__probe = settings.probe;

    /** @type {number|null} */
    this.__resultCode = settings.resultCode;

    /** @type {number|null} */
    this.__measurement = settings.measurement;

    /** @type {boolean} */
    this.__abortProvider = settings.abortProvider;

    /** @type {boolean} */
    this.__sendReport = settings.sendReport;
}

/**
 * @return {boolean}
 */
ProbeFinishedEvent.prototype.getAbortProvider = function() {
    return this.__abortProvider;
};

/**
 * @return {boolean}
 */
ProbeFinishedEvent.prototype.getSendReport = function() {
    return this.__sendReport;
};

/**
 * @return {!Probe}
 */
ProbeFinishedEvent.prototype.getProbe = function() {
    return this.__probe;
};

/**
 * @return {(number|null)}
 */
ProbeFinishedEvent.prototype.getResultCode = function() {
    return this.__resultCode;
};

/**
 * @return {(number|null)}
 */
ProbeFinishedEvent.prototype.getMeasurement = function() {
    return this.__measurement;
};

/**
 * @param {!Probe} probe
 * @param {(number|null)} resultCode
 * @param {(number|null)} measurement
 * @param {boolean} abortProvider
 * @param {boolean} sendReport
 * @return {!ProbeFinishedEvent}
 */
function createProbeFinishedEvent(probe, resultCode, measurement, abortProvider,
    sendReport) {
    return new ProbeFinishedEvent({
        probe: probe,
        resultCode: resultCode,
        measurement: measurement,
        abortProvider: abortProvider,
        sendReport: sendReport
    });
}

/**
 * @constructor
 * @param  settings
 */
function CacheNodeIdProbeFinishedEvent(settings) {
    /** @type {!Probe} */
    this.probe = settings.probe;

    /** @type {string} */
    this.cacheNodeId = settings.cacheNodeId;
}

/**
 * @constructor
 * @implements {RadarEvent}
 */
function ProviderFinishedEvent() {}

/**
 * @constructor
 * @implements {RadarEvent}
 * @param  settings
 */
function MeasurementReadyEvent(settings) {
    /** @type {!Provider} */
    this.__provider = settings.provider;

    /** @type {number} */
    this.__probeTypeId = settings.probeTypeId;

    /** @type {(number|null)} */
    this.__resultCode = settings.resultCode;

    /** @type {(number|null)} */
    this.__value = settings.value;

    /** @type {boolean} */
    this.__sendReport = settings.sendReport;
}

/**
 * @return {!Provider}
 */
MeasurementReadyEvent.prototype.getProvider = function() {
    return this.__provider;
};

/**
 * @return {number}
 */
MeasurementReadyEvent.prototype.getProbeTypeId = function() {
    return this.__probeTypeId;
};

/**
 * @return {(number|null)}
 */
MeasurementReadyEvent.prototype.getResultCode = function() {
    return this.__resultCode;
};

/**
 * @return {(number|null)}
 */
MeasurementReadyEvent.prototype.getValue = function() {
    return this.__value;
};

/**
 * @return {boolean}
 */
MeasurementReadyEvent.prototype.getSendReport = function() {
    return this.__sendReport;
};

/**
 * @constructor
 */
function SessionFinishedEvent() {}
/**
 * @constructor
 * @param {!RadarSessionSettings} settings
 */
function RadarSession(settings) {
    //debugger;
    /** @type {!BrowserProperties} */
    this.__browserProperties = new BrowserProperties(settings.window, settings.document);

    /** @type {number} */
    this.__requestorZoneId = settings.requestorZoneId;

    /** @type {number} */
    this.__requestorCustomerId = settings.requestorCustomerId;

    /** @type {function(number):boolean} */
    this.__transactionComparator = settings.transactionComparator;

    /** @type {string} */
    this.__samplerId = settings.samplerId;

    /** @type {number} */
    this.__samplerMajorVersion = settings.samplerMajorVersion;

    /** @type {number} */
    this.__samplerMinorVersion = settings.samplerMinorVersion;

    /** @type {string} */
    this.__providersJsonpCallbackName = settings.providersJsonpCallbackName;

    /**
     * @type {number}
     */
    this.__transactionId = this.makeTransactionId();

    /**
     * @type {function(!SessionFinishedEvent)}
     */
    this.__onSessionFinished = function() {};

    /**
     * @type 
     */
    this.__domains = {
        init: settings.initDomain || 'init.cedexis-radar.net',
        report: settings.reportDomain || 'rpt.cedexis.com',
        providers: settings.providersDomain || 'radar.cedexis.com'
    };

    /** @type {string} */
    this.__requestSignature = '';

    /** @type {Array.<!Provider>} */
    this.__providers = null;

    /** @type {Provider} */
    this.__currentProvider = null;

    /** @type {(string|null)} */
    this.__reportTag = settings.reportTag || null;
}

/**
 * @param {function(!SessionFinishedEvent)} callback
 */
RadarSession.prototype.setSessionFinishedCallback = function(callback) {
    this.__onSessionFinished = callback;
};

/**
 * @return {number}
 */
RadarSession.prototype.getRequestorZoneId = function() {
    return this.__requestorZoneId;
};

/**
 * @return {number}
 */
RadarSession.prototype.getRequestorCustomerId = function() {
    return this.__requestorCustomerId;
};

/**
 * @return {boolean}
 */
RadarSession.prototype.hasRequestSignature = function() {
    return !!(this.__requestSignature);
};

/**
 * @return {string}
 */
RadarSession.prototype.getRequestSignature = function() {
    return this.__requestSignature;
};

/**
 * @return {number}
 */
RadarSession.prototype.getTransactionId = function() {
    return this.__transactionId;
};

RadarSession.prototype.makeOnProviderCompleteCallback = function() {
    var that = this;
    return function() {
        that.onProviderComplete();
    };
};

RadarSession.prototype.onProviderComplete = function() {
    this.measureNextProvider();
};

/**
 * @return {function(!MeasurementReadyEvent)}
 */
RadarSession.prototype.makeMeasurementReadyCallback = function() {
    var that = this;
    return function(event) {
        that.onMeasurementReady(event);
    };
};

/**
 * @param {MeasurementReadyEvent} event
 */
RadarSession.prototype.onMeasurementReady = function(event) {
    var provider = event.getProvider();
    if (provider === this.__currentProvider
        && event.getSendReport()) {
        /** @type {number} */
        var providerOwnerZoneId = provider.getZoneId();
        /** @type {number} */
        var providerOwnerCustomerId = provider.getCustomerId();
        /** @type {number} */
        var providerId = provider.getProviderId();
        var substitutionConfig = provider.getSubstitutionConfiguration();
        if (substitutionConfig) {
            providerOwnerZoneId = substitutionConfig.zoneId;
            providerOwnerCustomerId = substitutionConfig.customerId;
            providerId = substitutionConfig.providerId;
        }
        var reportData = [
            this.__domains.report,
            'f1',
            this.__requestSignature,
            providerOwnerZoneId,
            providerOwnerCustomerId,
            providerId,
            event.getProbeTypeId(),
            event.getResultCode(),
            event.getValue(),
            provider.getCacheNodeId() || '0',
            this.__reportTag || '0'
        ];
        this.sendReport('//' + reportData.join('/'));
    }
};

/**
 * @param {string} value
 */
RadarSession.prototype.setRequestSignature = function(value) {
    this.__requestSignature = value;
};

/**
 * @param {string} cookie
 */
RadarSession.prototype.setCookie = function(cookie) {
    this.__browserProperties.setDocumentCookie(cookie);
};

/**
 * @param {string} cookieName
 * @return {string}
 */
RadarSession.prototype.getCookie = function(cookieName) {
    //debugger;
    var name = cookieName + '=';
    var cookieParts = this.__browserProperties.getDocumentCookie().split(';');
    var i = cookieParts.length;
    var part;
    while (i--) {
        part = cookieParts[i];
        //console.log(part);
        while (' ' === part.charAt(0)) {
            part = part.substring(1);
        }
        if (-1 < part.indexOf(name)) {
            return part.substring(name.length, part.length);
        }
    }
    return '';
};

/**
 * @return {number}
 */
RadarSession.prototype.makeTransactionId = function() {
    var crypto = this.__browserProperties.getCrypto();
    if (crypto && crypto['getRandomValues']) {
        var values = new Uint32Array(1);
        crypto['getRandomValues'](values);
        //console.log(values);
        return values[0];
    }
    return Math.floor(1000000000 * Math.random());
};

/**
 * @param {function(!Object)} callback
 */
RadarSession.prototype.startInitRequest = function(callback) {
    if (this.browserSupportsAjax()) {
        this.startInitRequestAjax(callback);
    } else {
        this.startInitRequestJsonp(callback);
    }
};

/**
 * @param {string} url
 */
RadarSession.prototype.sendReport = function(url) {
    if (this.browserSupportsAjax()) {
        this.makeAjaxGetRequest(url);
    } else {
        this.__browserProperties.insertScript(url);
    }
};

RadarSession.prototype.requestProviders = function() {
    //debugger;
    if (this.browserSupportsAjax()) {
        this.requestProvidersAjax();
    } else {
        this.requestProvidersJsonp();
    }
};

/**
 * @param {(string|null)} callback
 * @return {string}
 */
RadarSession.prototype.makeProvidersUrl = function(callback) {
    var url = [
        this.__domains.providers,
        this.__requestorZoneId,
        this.__requestorCustomerId,
        'radar',
        '1437151755',
        makeRandomString(20), // cache buster
        'providers.json'
    ];

    var deviceCaps = this.getDeviceCapabilities();
    var queryStringParts = [];
    for (var i in deviceCaps) {
        if (deviceCaps.hasOwnProperty(i)) {
            queryStringParts.push(i + '=' + deviceCaps[i]);
        }
    }

    var radarGeo = this.__browserProperties.getQueryStringArgument('radar-geo');
    if (radarGeo) {
        var pair = radarGeo.split('-');
        queryStringParts.push('country=' + pair[0]);
        queryStringParts.push('asn=' + pair[1]);
    }

    var providerCount = this.__browserProperties.getQueryStringArgument('radar-provider-count');
    if (!isNaN(providerCount)) {
        queryStringParts.push('providerCount=' + providerCount);
    }

    if (callback) {
        queryStringParts.push('callback=' + callback);
    }

    var queryString = '';
    if (0 < queryStringParts.length) {
        queryString = '?' + queryStringParts.join('&');
    }

    return '//' + url.join('/') + queryString;
};

/**
 * @return {!Object}
 */
RadarSession.prototype.getDeviceCapabilities = function() {
    return {
        'a': this.getCorsSupportFlag(),
        'b': this.getScriptLoadSupportLevel(),
        'n': this.getNavigationTimingSupportFlag(),
        'p': this.getHasPostMessageFlag(),
        'r': this.getResourceTimingSupportFlag()
    };
};

/**
 * @return {string}
 */
RadarSession.prototype.getCorsSupportFlag = function() {
    if (!this.browserSupportsAjax()) {
        return '0';
    }
    return '1';
};

/**
 * @return {string}
 */
RadarSession.prototype.getScriptLoadSupportLevel = function() {
    var script = this.__browserProperties.createElement('script');
    if (isFunction(script['addEventListener'])) {
        return '2';
    }
    if (isDefined(script['readyState'])) {
        return '1';
    }
    return '0';
};

/**
 * @return {string}
 */
RadarSession.prototype.getNavigationTimingSupportFlag = function() {
    if (this.__browserProperties.testUserAgentString(/msie/i)) {
        //console.log('Internet Explorer!!!');
        // Recent version of IE deprecate compatMode in favor of documentMode.
        var docMode = this.__browserProperties.getDocumentProperty('documentMode');
        var compatMode = this.__browserProperties.getDocumentProperty('compatMode');
        if (docMode) {
            if (9 > docMode) {
                return '0';
            }
        } else if ('BackCompat' === compatMode) {
            return '0';
        }
    }

    if (!this.__browserProperties.getPerformanceObject()) {
        return '0';
    }

    return '1';
};

/**
 * @return {string}
 */
RadarSession.prototype.getHasPostMessageFlag = function() {
    if (isFunction(this.__browserProperties.getWindowProperty('postMessage'))) {
        return '1';
    }
    return '0';
};

/**
 * @return {string}
 */
RadarSession.prototype.getResourceTimingSupportFlag = function() {
    /**
     * @param {string} userAgent
     * @return {boolean}
     */
    function isIeLte10(userAgent) {
        // Typical UA string
        // Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.1; WOW64; Trident/6.0)
        var matches = /msie (\d+)/i.exec(userAgent);
        if (matches) {
            return 10 >= parseInt(matches[1], 10);
        }
        return false;
    }

    var perf = this.__browserProperties.getPerformanceObject();
    var userAgent = this.__browserProperties.getUserAgentString();
    if (perf
        && isFunction(perf['getEntriesByType'])
        && !isIeLte10(userAgent)) {
        return '1';
    }

    return '0';
};

/**
 * @return {Function}
 */
RadarSession.prototype.makeAjaxProvidersHandler = function() {
    var that = this;
    return function() {
        //debugger;
        that.handleOnGotProviders(this['responseText']);
    };
};

/**
 * @param {string} source
 */
RadarSession.prototype.handleOnGotProviders = function(source) {
    if (!this.__providers) {
        this.__providers = providersFromJson(
            this.__browserProperties,
            source,
            this.makeSessionPropertiesObject()
        );
        //debugger;
        this.measureNextProvider();
    }
};

/**
 * @param {*} data
 */
RadarSession.prototype.handleOnGotProvidersAsJsonp = function(data) {
    if (!this.__providers
        && data['requestor']['zoneId'] == this.__requestorZoneId
        && data['requestor']['customerId'] == this.__requestorCustomerId) {
        this.__providers = providersFromParsed(
            data['providers'],
            this.__browserProperties,
            this.makeSessionPropertiesObject()
        );
        //debugger;
        this.measureNextProvider();
    }
};

RadarSession.prototype.onGotJsonpProviders = function(data) {
    //debugger;
    if (!this.__providers
        && this.__requestorZoneId === data['requestor']['zoneId']
        && this.__requestorCustomerId === data['requestor']['customerId']) {
        this.__providers = providersFromParsed(
            data['providers'],
            this.__browserProperties,
            this.makeSessionPropertiesObject()
        );
        this.measureNextProvider();
    }
};

/**
 * @return {!SessionProperties}
 */
RadarSession.prototype.makeSessionPropertiesObject = function() {
    return {
        requestorZoneId: this.__requestorZoneId,
        requestorCustomerId: this.__requestorCustomerId,
        transactionId: this.__transactionId,
        requestSignature: this.__requestSignature,
        providerComplete: this.makeOnProviderCompleteCallback(),
        measurementReady: this.makeMeasurementReadyCallback(),
        transactionComparator: this.__transactionComparator
    };
};

RadarSession.prototype.measureNextProvider = function() {
    //debugger;
    if (0 < this.__providers.length) {
        this.__currentProvider = this.__providers.shift();
        this.__currentProvider.beginMeasurements();
    } else {
        //console.log('RadarSession.prototype.measureNextProvider; session finished');
        this.__browserProperties.clearCdxDiv();
        this.__onSessionFinished(new SessionFinishedEvent());
    }
};

RadarSession.prototype.requestProvidersAjax = function() {
    //debugger;
    this.makeAjaxGetRequest(
        this.makeProvidersUrl(null),
        this.makeAjaxProvidersHandler()
    );
};

RadarSession.prototype.requestProvidersJsonp = function() {
    var url = this.makeProvidersUrl(this.__providersJsonpCallbackName);
    this.__browserProperties.insertScript(url);
};

/**
 * @return {boolean}
 */
RadarSession.prototype.browserSupportsAjax = function() {
    var temp = this.getXhr();
    if (temp) {
        if (isDefined(temp['withCredentials'])) {
            return true;
        }
    }
    return false;
};

/**
 * @param {Function} callback
 */
RadarSession.prototype.startInitRequestAjax = function(callback) {
    this.makeAjaxGetRequest(
        this.makeInitUrl('xml'),
        this.makeAjaxInitCallback(callback)
    );
};

/**
 * @param {Function} callback
 */
RadarSession.prototype.makeAjaxInitCallback = function(callback) {
    /** @type {!RadarSession} */
    var that = this;
    return function() {
        //debugger;
        if (this.responseText) {
            var matches = /<requestSignature>([^<]+)/.exec(this.responseText);
            if (matches && matches[1]) {
                that.setRequestSignature(matches[1]);
                callback();
            }
        }
    };
};

/**
 * @param {function(!Object)} callback
 */
RadarSession.prototype.startInitRequestJsonp = function(callback) {
    /** @type {string} */
    var url = this.makeInitUrl('jsonp');
    //console.log('Init URL: ' + url);
    var cdx = this.__browserProperties.createWindowObject('cdx', {}, false);
    cdx['f'] = cdx['f'] || this.makeJsonpInitCallback();

    var requestorKey = this.__requestorZoneId + ';' + this.__requestorCustomerId;
    var cedexis = this.__browserProperties.createWindowObject('cedexis', {}, false);
    cedexis['requestors'] = cedexis['requestors'] || {};
    cedexis['requestors'][requestorKey] = this.makeJsonpInitCallbackForSession(callback);

    // Make a request to the init server to obtain a request signature
    this.__browserProperties.insertScript(url);
};

RadarSession.prototype.makeJsonpInitCallbackForSession = function(callback) {
    var that = this;
    return function(data) {
        if ('a' in data) {
            that.setRequestSignature(data['a']);
            callback();
        }
    };
};

RadarSession.prototype.makeJsonpInitCallback = function() {
    /**
     * @type {!BrowserProperties}
     */
    var browserProperties = this.__browserProperties;
    return function(data) {
        //console.log(data);
        //debugger;
        if ('c' in data && 'd' in data) {
            var requestorKey = data['c'] + ';' + data['d'];
            var cedexis = browserProperties.getWindowProperty('cedexis');
            if (requestorKey in cedexis['requestors']) {
                var callback = cedexis['requestors'][requestorKey];
                if (callback) {
                    delete cedexis['requestors'][requestorKey];
                    callback(data);
                }
            }
        }
    };
};

/**
 * @param {string} format
 */
RadarSession.prototype.makeInitUrl = function(format) {
    var securityFlag = 'https:' === this.__browserProperties.getPageProtocol() ? 's' : 'i';
    var seed = [];
    seed.push('i1');
    seed.push(this.__samplerId);
    seed.push(this.__samplerMajorVersion);
    seed.push(this.__samplerMinorVersion);
    seed.push(this.__requestorZoneId);
    seed.push(this.__requestorCustomerId);
    seed.push(this.__transactionId);
    seed.push(securityFlag);
    seed = seed.join('-');

    // Assemble url
    var url = [];
    url.push(seed + '.' + this.__domains.init);
    url.push('i1');
    url.push(Math.floor((new Date()).getTime() / 1000).toString(10));
    url.push(this.__transactionId);
    url.push(format);
    url = '//' + url.join('/');
    url += '?seed=' + seed;
    //console.log('make_init_url returning: ' + url);
    return url;
};

/**
 * @param {string} url
 * @param {Function=} callback
 * @param {number=} timeout
 */
RadarSession.prototype.makeAjaxGetRequest = function(url, callback, timeout) {
    var request = this.getXhr();
    if (request) {
        try {
            request.open('GET', url, true);
            if (callback) {
                request.onreadystatechange = function() {
                    //debugger;
                    if ((200 === this.status) && (4 === this.readyState)) {
                        callback.call(this);
                    }
                };
            }
            request.timeout = timeout || 10000;
            request.send();
        } catch (ignore) {
            // Swallow any exception
        }
    }
};

/**
 * @param  settings
 * @return {!RadarSession}
 */
RadarSession.prototype.sendPltReport = function(settings) {
    // Send a PLT report, but if we've already sent one for this page view,
    // set all the numbers to 0 so we don't pollute Lime with duplicate
    // data.
    var navtimingProperties = [
        'navigationStart',
        'unloadEventStart',
        'unloadEventEnd',
        'redirectStart',
        'redirectEnd',
        'fetchStart',
        'domainLookupStart',
        'domainLookupEnd',
        'connectStart',
        'connectEnd',
        'secureConnectionStart',
        'requestStart',
        'responseStart',
        'responseEnd',
        'domLoading',
        'domInteractive',
        'domContentLoadedEventStart',
        'domContentLoadedEventEnd',
        'domComplete',
        'loadEventStart',
        'loadEventEnd'
    ];

    function convert(value) {
        if (undefined === value) {
            return 0;
        }
        return value;
    }

    function validate(data) {
        //console.log(data);
        if (data['connectEnd'] < data['connectStart']) {
            return false;
        }
        if (data['domainLookupEnd'] < data['domainLookupStart']) {
            return false;
        }
        if (data['domComplete'] < data['domLoading']) {
            return false;
        }
        if (data['fetchStart'] < data['navigationStart']) {
            return false;
        }
        if (data['loadEventEnd'] < data['loadEventStart']) {
            return false;
        }
        if (data['loadEventEnd'] < data['navigationStart']) {
            return false;
        }
        if (data['responseEnd'] < data['responseStart']) {
            return false;
        }
        if (data['responseStart'] < data['requestStart']) {
            return false;
        }
        return true;
    }

    var performance = this.__browserProperties.getPerformanceObject();
    if (performance) {
        var timing = performance['timing'];
        if (timing) {
            var reportData = [
                this.__domains.report,
                'n1',
                0
            ];
            for (var i = 0; i < navtimingProperties.length; i += 1) {
                reportData.push(settings.pltSent ? '0' : convert(timing[navtimingProperties[i]]));
            }
            reportData.push(this.__requestSignature);
            reportData.push(settings.reportTag);
            reportData.push(settings.pltSent ? '0' : this.getStartRenderTimestamp());

            // Don't send invalid navtiming data
            if (validate(timing)) {
                this.sendReport('//' + reportData.join('/'));
            }
        }
    }
    return this;
};

/**
 * @return {number}
 */
RadarSession.prototype.getStartRenderTimestamp = function() {
    var chrome = this.__browserProperties.getWindowProperty('chrome');
    if (chrome && chrome['loadTimes']) {
        var loadTimes = chrome['loadTimes']();
        //console.log(load_times);
        // Convert from seconds with microsecond to milliseconds
        return Math.round(1000 * loadTimes['firstPaintTime']);
    } else {
        var perf = this.__browserProperties.getPerformanceObject();
        if (perf && perf['timing'] && perf['timing']['msFirstPaint']) {
            return Math.round(perf['timing']['msFirstPaint']);
        }
    }
    return 0;
};

/**
 * @return {XMLHttpRequest|undefined}
 */
RadarSession.prototype.getXhr = function() {
    var Ctor = this.__browserProperties.getWindowProperty('XMLHttpRequest');
    if (Ctor) {
        return new Ctor();
    }
};

/**
 * @param {Object} event
 */
RadarSession.prototype.processWindowMessage = function(event) {
    //debugger;
    if (this.__currentProvider
        && 'data' in event) {
        var data;
        try {
            data = JSON.parse(event['data']);
        } catch (ignore) {}
        if (data) {
            //debugger;
            if ('source' in data
                && ('uni' === data['source']
                || 'dsa' === data['source'])) {
                this.__currentProvider.processWindowMessageData(data);
            }
        }
    }
};

RadarSession.prototype.clearResourceTimings = function() {
    this.__browserProperties.clearResourceTimings();
};

/**
 * @param {number} maxSize
 */
RadarSession.prototype.setResourceTimingBufferSize = function(maxSize) {
    this.__browserProperties.setResourceTimingBufferSize(maxSize);
};
(function() {
    if (!window['cedexis']['api']['instance']) {
        //debugger;
        var instance
            = window['cedexis']['api']['instance']
            = new RadarApi(
                window,
                document,
                window['cedexis']['api']['events']);
        instance.installHandlers();
        instance.processNextEvent();
    }
}());

}(window,document));
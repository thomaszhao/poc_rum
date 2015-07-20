"use strict";
$(function() {
    //debugger;
    var api = cedexis.api.create({
        customerId: 16156,
        cookieDomain: 'test-pages.s3.amazonaws.com',
        cookiePath: '/api/simple/',
        site: 'www' // optional
    });

    api.impact({
        category: 'CART',
        conversion: 'CART',
        kpi: {
            "items": 2,
            "value": 34.99,
            "currency": "euro"
        },
        clearResourceTimings: true,
        resourceTimingBufferSize: 300
    });

    setTimeout(
        function() {
            api.radar({
                clearResourceTimings: true
            });
        },
        1000
    );

    $('#doImpact').click(function() {
        api.impact({
            category: 'CART',
            conversion: 'CART',
            kpi: {
                "items": 2,
                "value": 34.99,
                "currency": "euro"
            },
            clearResourceTimings: true
        });
    });

    $('#doRadar').click(function() {
        api.radar({
            clearResourceTimings: true
        });
    });
});

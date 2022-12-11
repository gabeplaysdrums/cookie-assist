(function($) {

    const version = "{{VERSION}}";

    const log = (function(){
        function makeLogFunction(consoleFunc) {
            return function(msg) {
                return consoleFunc(`[CookieAssist] ${msg}`);
            };
        }

        return {
            debug: makeLogFunction(console.debug),
            info: makeLogFunction(console.log),
            error: makeLogFunction(console.error),
            warn: makeLogFunction(console.warn),
        };
    })();

    if (window.CookieAssist && window.CookieAssist.version)
    {
        log.error(`Detected version ${window.CookieAssist.version} was already loaded.  Aborting.`);
        return;
    }

    function exists($selector) {
        return $selector && $selector.length > 0;
    }

    function parseShortNumber(str) {
        var m = null;

        if ((m = str.match(/(\d+(,\d\d\d)*(\.\d+)?)( (\w+))?/)) != null)
        {
            var numberStr = m[1].replaceAll(',', '');
            var wordStr = m[5];
            var multiplier = 1;

            var number = parseFloat(numberStr);

            if (wordStr)
            {
                const words = [
                    'thousand',
                    'million',
                    'billion',
                    'trillion',
                    'quadrillion',
                    'quintillion',
                    'sextillion',
                    'septillion',
                    'octillion',
                    'nonillion',
                ];

                var multiplier = 1;

                for(var i=0; i < words.length; i++)
                {
                    multiplier *= 1000;
                    if (wordStr == words[i]) {
                        return number * multiplier;
                    }
                }

                return -1;
            }

            return number;
        }

        return -1;
    }

    var $tooltipSubject = null;

    $('.product,.upgrade')
        .mouseover(function(){ $tooltipSubject = $(this); })
        .mouseout(function(){ $tooltipSubject = null; });

    var $assist = $('<div>')
        .attr('id', 'cookie-assist')
        .css('display', 'inline-block')
        .css('padding', '5px')
        .css('margin', '2px')
        .css('color', '#fff')
        .append($(`<b>Cookie Assistant v${version}:</b> `));

    function updateRecommendation() {
        var $originalTooltipSubject = $tooltipSubject;

        var $tooltip = $('#tooltip');
        var $tooltipParent = $tooltip.parent();
        $tooltip.remove();

        var products = [];

        // find all buildings
        log.debug('bulidings:');
        $('.product.unlocked').each(function () {

            var product = {
                elem: this,
                name: $(this).find('.productName').first().text(),
                price: parseShortNumber($(this).find('.price').first().text()),
                owned: parseInt($(this).find('.owned').first().text()),
                enabled: $(this).hasClass('enabled'),
            };

            $(this).mouseover();
            $tooltip.find('.descriptionBlock').each(function() {
                var text = $(this).text();
                var m = null;

                if ((m = text.match(/each .* produces (.*) cookies per second/)) != null)
                {
                    product.cpsEach = parseShortNumber(m[1]);
                    return;
                }

                if ((m = text.match(/producing (.*) cookies per second \((\d+(\.\d*)?)% of total CpS\)/)) != null)
                {
                    product.cpsTotal = parseShortNumber(m[1]);
                    product.cpsPct = parseFloat(m[2]) / 100.0;
                    return;
                }
            });
            $(this).mouseout();
            $tooltip.mouseout();

            product.cpsEachPerPrice = product.cpsEach / product.price;
            products.push(product);
        });

        $tooltipParent.append($tooltip);

        if (exists($originalTooltipSubject)) {
            $tooltipSubject = $originalTooltipSubject;
            $originalTooltipSubject.mouseover();
        }

        products.sort((a, b) => { return b.cpsEachPerPrice - a.cpsEachPerPrice; });

        products.forEach((product) => {
            var productCopy = Object.assign({}, product);
            delete productCopy['elem'];
            log.debug(JSON.stringify(productCopy));
        });

        $('.product').css('border', '');

        if (products.length > 0)
        {
            $(products[0].elem).css('border', '5px solid red');
        }
    }

    function clearRecommendation() {
        $('.product').css('border', '');
    }

    var flags = {};

    $('.product,.upgrade').click(function() {
        if (flags.recommend) {
            updateRecommendation();
        }
        else {
            clearRecommendation();
        }
    });

    var iterCount = 0;
    
    var interval = window.setInterval(function() {

        iterCount++;

        log.debug('computing action');

        if (flags.goldenCookie) {
            var $shimmer = $('.shimmer').first();

            if (exists($shimmer))
            {
                log.info('clicking golden cookie');
                $shimmer.click();
                return;
            }
        }

        if (flags.recommend && iterCount % 20 == 0) {
            updateRecommendation();
        }
        else if (!flags.recommend) {
            clearRecommendation();
        }

        if (flags.bigCookie) {
            log.debug('clicking big cookie');
            $('#bigCookie').click();
            return;
        }

    }, 100);

    function addFlagToMenu(name, label) {
        $assist.append(
            $(`<input type="checkbox" id="cookie-assist-flag-${name}">`)
                .css('margin-left', '10px')
                .change(function() {
                    flags[name] = $(this).is(":checked");
                    log.info(`flag ${name} ${flags[name] ? 'enabled' : 'disabled'}`);
                })
        );
    
        $assist.append(
            $(`<label for="cookie-assist-flag-${name}">${label}</label>`)
        );
    }

    addFlagToMenu('bigCookie', 'click big cookie');
    addFlagToMenu('goldenCookie', 'click golden cookies');
    addFlagToMenu('recommend', 'show recommendations');

    $('#topBar').children().css('display', 'none');
    $("#topBar").append($assist);

    log.info(`Loaded version ${version}`);

    // exports
    window.CookieAssist = window.CookieAssist || {};
    $.extend(window.CookieAssist, {
        version: version,
        flags: flags,
    });

})(jQuery);
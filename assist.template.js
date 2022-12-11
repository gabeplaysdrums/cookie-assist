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

    function clearRecommendation() {
        $('.product,.upgrade').css('border', '0px');
    }

    function updateRecommendation(show) {
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

            product.warning = exists($tooltip.find('.warning'));

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

            if (product.cpsEach && product.price) {
                product.cpsEachPerPrice = product.cpsEach / product.price;
            }
            else {
                product.cpsEachPerPrice = -1;
            }
            
            // avoid buildings that have a warning
            if (!product.warning)
                products.push(product);
        });

        // find upgrades
        $('.upgrade.enabled').each(function() {
            $(this).mouseover();

            var product = {
                elem: this,
                name: $tooltip.find('.name').text(),
                price: parseShortNumber($tooltip.find('.price').text()),
                cpsEachPerPrice: -1,
                enabled: true,
                warning: exists($tooltip.find('.warning')),
            };

            // avoid upgrades that have a warning
            if (!product.warning)
                products.push(product);

            $(this).mouseout();
            $tooltip.mouseout();
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

        clearRecommendation();

        var recommended = null;

        if (products.length > 0) {
            recommended = products[0];

            if (!recommended.enabled) {
                // if there are not enough cookies to purchase, opportunistically recommend a product with unknown CpS

                // prefer less expensive products
                products.sort((a, b) => { return a.price - b.price; });

                for (var i=0; i < products.length; i++) {
                    if (!products[i].cpsEach && products[i].enabled) {
                        recommended = products[i];
                        break;
                    }
                }
            }
        }

        if (show && recommended)
            $(recommended.elem).css('border', '5px solid red');

        return recommended;
    }

    var flags = {};

    $('.product,.upgrade').click(function() {
        if (flags.recommend || flags.purchase) {
            updateRecommendation(flags.recommend);
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

        if (flags.recommend || flags.purchase) {
            if (iterCount % 20 == 0) {
                var product = updateRecommendation(flags.recommend);

                if (flags.purchase && product && product.enabled) {
                    log.info(`purchasing ${product.name} @ ${product.cpsEachPerPrice} CpS per price`);
                    $(product.elem).click();
                    return;
                }
            }
        }
        else {
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
    addFlagToMenu('purchase', 'purchase recommendations');

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
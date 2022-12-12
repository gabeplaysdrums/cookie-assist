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

    function parseMultiplierText(str) {
        var m = null;

        if ((m = str.match(/twice/)) != null)
            return 2;

        if ((m = str.match(/(\d+) times/)) != null)
            return parseInt(m[1]);

        return 1;
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

    var lastRecommended = null;

    function clearRecommendation() {
        $('.product,.upgrade').find('.cookie-assist-recommend').remove();
    }

    function updateRecommendation(show) {
        var $originalTooltipSubject = $tooltipSubject;

        var $tooltip = $('#tooltip');
        var $tooltipParent = $tooltip.parent();
        $tooltip.remove();

        var knownProducts = [];
        var unknownProducts = [];
        var ignoredProducts = [];

        function addProduct(product) {
            // avoid buildings that have a warning
            if (product.warning) {
                ignoredProducts.push(product);
                return;
            }

            if (product.cpsEach && product.price) {
                product.cpsEachPerPrice = product.cpsEach / product.price;
                knownProducts.push(product);
                return;
            }

            unknownProducts.push(product);
        }

        function logProduct(product, logFn) {
            if (!product) {
                logFn('  (nothing)');
                return;
            }
            
            var productCopy = Object.assign({}, product);
            delete productCopy['elem'];

            if (product.building) {
                productCopy.building = Object.assign({}, product.building);
                delete productCopy.building['elem'];
            }

            logFn(`  ${JSON.stringify(productCopy)}`);
        }

        // get production CpS
        var cpsProd = (function() {
            var text = $('#cookiesPerSecond').text();
            var m = null;

            if ((m = text.match(/per second: (.*)/)) != null)
            {
                return parseShortNumber(m[1]);
            }
        })();

        var pluralBuildings = {};
        var grandmaBoostPct = {};

        // find all buildings
        $('.product.unlocked').each(function () {

            var product = {
                elem: this,
                name: $(this).find('.productName').first().text(),
                price: parseShortNumber($(this).find('.price').first().text()),
                owned: parseInt($(this).find('.owned').first().text()),
                enabled: $(this).hasClass('enabled'),
                type: 'Building',
            };

            $(this).mouseover();

            product.warning = exists($tooltip.find('.warning'));

            $tooltip.find('.descriptionBlock').each(function() {
                var text = $(this).text();
                var m = null;

                if ((m = text.match(/each .* produces (.*) cookies? per second/)) != null)
                {
                    product.cpsEach = parseShortNumber(m[1]);
                    return;
                }

                if ((m = text.match(/producing (.*) cookies? per second \((\d+(\.\d*)?)% of total CpS\)/)) != null)
                {
                    product.cpsTotal = parseShortNumber(m[1]);
                    product.cpsPct = parseFloat(m[2]) / 100.0;
                    return;
                }

                if (product.name == 'Grandma' && 
                    (m = text.match(/also boosting some other buildings: (.*) - all combined, these boosts account for (.*) cookies per second \((\d+(\.\d*)?)% of total CpS\)/)) != null)
                {
                    // compute grandma buffs
                    var boostsText = m[1];
                    var boostsTotal = parseShortNumber(m[2]);
                    var boostsTotalCpsPct = parseFloat(m[2]) / 100.0;

                    product.buildingBoostPcts = product.buildingBoostPcts || {};

                    boostsText.split(',').forEach((text) => {
                        if ((m = text.match(/(\w+( \w+)*) \+(\d+(\.\d*)?)%/)) != null) {
                            var buildingPlural = m[1].toLowerCase();
                            var boostPct = parseFloat(m[3]) / 100.0;

                            product.buildingBoostPcts[buildingPlural] = boostPct;
                        }
                    });

                    return;
                }
            });
            $(this).mouseout();
            $tooltip.mouseout();

            var pluralized = pluralize(product.name.toLowerCase());
            pluralBuildings[pluralized] = product;

            addProduct(product);
        });

        // find upgrades
        $('.upgrade').each(function() {
            $(this).mouseover();

            var product = {
                elem: this,
                name: $tooltip.find('.name').text(),
                price: parseShortNumber($tooltip.find('.price').text()),
                enabled: $(this).hasClass('enabled'),
                warning: exists($tooltip.find('.warning')),
                type: $tooltip.find('.tag').first().text(),
            };

            $tooltip.find('.description').each(function() {
                var text = $(this).text();
                var m = null;

                if (product.type == 'Cookie' && 
                    (m = text.match(/Cookie production multiplier \+(\d+(\.\d+)?)%\./)) != null)
                {
                    product.addedProdMult = parseFloat(m[1]) / 100;
                    product.cpsEach = cpsProd * product.addedProdMult;
                    return;
                }

                if (product.type == 'Upgrade' &&
                    (m = text.match(/(\w+( \w+)*) are (.*) as efficient\./)) != null)
                {
                    var pluralBuilding = m[1].toLowerCase();
                    var multiplierText = m[3];

                    var building = (function() {
                        for (var name in pluralBuildings) {
                            if (pluralBuilding.indexOf(name) < 0)
                                continue;
                            return pluralBuildings[name];
                        }

                        return null;
                    })();

                    if (building) {
                        product.building = building;
                        product.buildingMult = parseMultiplierText(multiplierText);
                        product.cpsEach = (product.buildingMult - 1) * building.cpsTotal;
                    }

                    return;
                }

                if (product.type == 'Upgrade' && 
                    (m = text.match(/Clicking gains \+(\d+(\.\d+)?)% of your CpS/)) != null)
                {
                    product.addedProdMult = parseFloat(m[1]) / 100;
                    product.cpsEach = cpsProd * product.addedProdMult * averageMouseClicksPerSecond;
                    return;
                }
            });

            $(this).mouseout();
            $tooltip.mouseout();

            addProduct(product);
        });

        // add grandma boosts
        var grandmas = pluralBuildings['grandmas'];

        if (grandmas && grandmas.owned > 0 && grandmas.price && grandmas.cpsEach && grandmas.buildingBoostPcts) {
            for (var pluralBuilding in grandmas.buildingBoostPcts) {
                var building = pluralBuildings[pluralBuilding];
                if (!building || !building.cpsTotal)
                    continue;
                var cpsPctPerGrandma = grandmas.buildingBoostPcts[pluralBuilding] / grandmas.owned;
                grandmas.cpsEach += building.cpsTotal * cpsPctPerGrandma;
            }

            grandmas.cpsEachPerPrice = grandmas.cpsEach / grandmas.price;
        }

        $tooltipParent.append($tooltip);

        if (exists($originalTooltipSubject)) {
            $tooltipSubject = $originalTooltipSubject;
            $originalTooltipSubject.mouseover();
        }

        knownProducts.sort((a, b) => { return b.cpsEachPerPrice - a.cpsEachPerPrice; });
        unknownProducts.sort((a, b) => { return a.price - b.price; });
        ignoredProducts.sort((a, b) => { return a.price - b.price; });

        log.debug('known products:');
        knownProducts.forEach((product) => { logProduct(product, log.debug); });
        log.debug('unknown products:');
        unknownProducts.forEach((product) => { logProduct(product, log.debug); });
        log.debug('ignored products:');
        ignoredProducts.forEach((product) => { logProduct(product, log.debug); });

        clearRecommendation();

        var recommended = null;

        // recommend the product with the highest CpS per price
        if (knownProducts.length > 0) {
            recommended = knownProducts[0];
        }

        // recommend an unknown product if it is cheaper
        if (unknownProducts.length > 0 && 
            (recommended == null || unknownProducts[0].price < recommended.price)) {
            recommended = unknownProducts[0];
        }

        if (recommended && show)
            $(recommended.elem).append(
                $('<div>')
                    .addClass('cookie-assist-recommend')
                    .css('display', 'inline-block')
                    .css('width', '13px')
                    .css('height', '13px')
                    .css('position', 'relative')
                    .css('top', '0')
                    .css('left', '0')
                    .css('background-color', 'rgb(117, 171, 52)')
                    .css('border-radius', '7px')
                    .css('box-shadow', '0 0 20px 10px rgb(117, 171, 52)')
                    .css('border', '1px solid rgba(0, 0, 0, 0.8)')
            );

        if (recommended != lastRecommended && 
            (recommended == null || lastRecommended == null || recommended.name != lastRecommended.name))
        {
            log.info('now recommending:');
            logProduct(recommended, log.info);
        }

        lastRecommended = recommended;
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

    var averageMouseClicksPerSecond = 0.0;

    (function() {
        var clickCount = 0;
        var lastClickTime = 0;

        $('#bigCookie').click(function() {

            var clickTime = window.performance.now();
            clickCount++;

            if (clickCount > 1) {
                var intervalMs = (clickTime - lastClickTime);
                var ratePerSecond = 1000.0 / intervalMs;

                if (clickCount == 2) {
                    averageMouseClicksPerSecond = ratePerSecond;
                }
                else {
                    averageMouseClicksPerSecond += (ratePerSecond - averageMouseClicksPerSecond) / (clickCount - 1);
                }
            }

            lastClickTime = clickTime;

            log.debug(`average clicks per second: ${averageMouseClicksPerSecond}`);
        });
    })();

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
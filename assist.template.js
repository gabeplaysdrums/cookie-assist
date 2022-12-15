(function($) {

    const version = '{{FULL_VERSION}}';
    const shortVersion = '{{VERSION}}';
    
    var options = {
        recommendCount: 5,
    };

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

    // remove ads
    $('.supportComment').parent().empty();

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

    var $assist = $('<div>')
        .attr('id', 'cookie-assist')
        .css('display', 'inline-block')
        .css('padding', '5px')
        .css('margin', '2px')
        .css('color', '#fff')
        .append($(`<b title="version ${version}">Cookie Assistant v${shortVersion}:</b> `));

    var $eta = $('<span>')
        .css('margin-left', '10px');

    var lastRecommended = [];
    var cpsProd = (function() {
        var count = 0;
        var samples = new Array(5000);
        var sum = 0;
        var latest = NaN;

        return {
            latest: function() {
                return latest;
            },
            addSample: function(val) {
                latest = val;
                if (val == null)
                    return;
                sum += val;
                var expireVal = samples[count % samples.length];
                samples[count % samples.length] = val;
                count++;
                if (count > samples.length)
                    sum -= expireVal;
            },
            movingAverage: function() {
                if (count > 0)
                    return sum / Math.min(count, samples.length);
                else
                    return NaN;
            }
        };
    })();

    var gameTooltipHook = (function() {
        var originalDraw = Game.tooltip.draw;
        var lastSubject = null;

        function hookDraw(elem) {
            lastSubject = elem;
            return originalDraw.apply(Game.tooltip, [...arguments]);
        }

        Game.tooltip.draw = hookDraw;

        function currentSubject() {
            if (!Game.tooltip.on)
                return null;
            return lastSubject;
        }

        return {
            subject: currentSubject,
            subjectQuery: function() {
                var subject = currentSubject();
                if (subject)
                    return $(subject);
                return $();
            }
        };
    })();

    function clearRecommendation() {
        $('.product,.upgrade').not('.noFrame').find('.cookie-assist-recommend').remove();
        $eta.empty();
    }

    function updateRecommendation(show) {
        var $originalTooltipSubject = gameTooltipHook.subjectQuery();

        // direct game's tooltip element to a fake one
        var originalTooltip = Game.tooltip.tt;
        var originalTooltipAnchor = Game.tooltip.tta;
        var $tooltip = $('<div>');
        var $tooltipAnchor = $('<div>');
        Game.tooltip.tt = $tooltip[0];
        Game.tooltip.tta = $tooltipAnchor[0];

        // temporarily suspend mouse down behavior
        var originalMouseDown = Game.mouseDown;
        Game.mouseDown = 0;

        $originalTooltipSubject.mouseout();

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

            if (product.grandmaBoostBuilding) {
                productCopy.grandmaBoostBuilding = Object.assign({}, product.grandmaBoostBuilding);
                delete productCopy.building['elem'];
            }

            logFn(`  ${JSON.stringify(productCopy)}`);
        }

        var pluralBuildings = {};
        var grandmaBoostPct = {};

        // find all buildings
        $('.product.unlocked').each(function () {

            var product = {
                elem: this,
                name: null,
                price: parseShortNumber($(this).find('.price').first().text()),
                owned: parseInt($(this).find('.owned').first().text()),
                enabled: $(this).hasClass('enabled'),
                type: 'Building',
            };

            gameTooltipHook.subjectQuery().mouseout();
            $(this).mouseover();
            Game.tooltip.shouldHide = 1;

            product.name = $tooltip.find('.name').text();
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

            var pluralized = pluralize(product.name.toLowerCase());
            pluralBuildings[pluralized] = product;

            addProduct(product);
        });

        var grandmas = pluralBuildings['grandmas'];

        // find upgrades
        $('.upgrade').not('.noFrame').each(function() {
            gameTooltipHook.subjectQuery().mouseout();
            $(this).mouseover();
            Game.tooltip.shouldHide = 1;

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
                    product.cpsEach = cpsProd.latest() * product.addedProdMult;
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
                }

                if (product.type == 'Upgrade' &&
                    (m = text.match(/(\w+( \w+)*) gain \+(\d+(\.\d+)?)% CpS per (\d+) grandmas\./)) != null)
                {
                    var pluralBuilding = m[1].toLowerCase();
                    product.boostPctPerNGrandmas = parseFloat(m[3]) / 100;
                    product.grandmasPerBoost = parseInt(m[5]);

                    var building = (function() {
                        for (var name in pluralBuildings) {
                            if (pluralBuilding.indexOf(name) < 0)
                                continue;
                            return pluralBuildings[name];
                        }

                        return null;
                    })();

                    if (building) {
                        product.grandmaBoostBuilding = building;

                        if (grandmas && grandmas.owned && 
                            product.boostPctPerNGrandmas && product.grandmasPerBoost) {
                            product.cpsEach = product.cpsEach || 0;
                            product.cpsEach += building.cpsEach * product.boostPctPerNGrandmas * grandmas.owned / product.grandmasPerBoost;
                        }
                    }
                }

                if (product.type == 'Upgrade' && 
                    (m = text.match(/Clicking gains \+(\d+(\.\d+)?)% of your CpS/)) != null)
                {
                    product.addedProdMult = parseFloat(m[1]) / 100;
                    product.cpsEach = cpsProd.latest() * product.addedProdMult * averageMouseClicksPerSecond;
                }
            });
            
            addProduct(product);
        });

        // calculate grandma boosts
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

        gameTooltipHook.subjectQuery().mouseout();

        // restore game's original tooltip element
        Game.tooltip.tt = originalTooltip;
        Game.tooltip.tta = originalTooltipAnchor;

        $originalTooltipSubject.mouseover();

        // resume mouse down behavior
        Game.mouseDown = originalMouseDown;

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

        // recommend the products with the highest CpS per price
        var recommended = knownProducts.slice();

        // prefer an unknown product if it is cheaper
        if (unknownProducts.length > 0 && 
            (recommended.length == 0 || unknownProducts[0].price < recommended[0].price)) {
            recommended.unshift(unknownProducts[0]);

            unknownProducts.slice(1).forEach((product) => { recommended.push(product); });
        }
        else {
            unknownProducts.forEach((product) => { recommended.push(product); });
        }

        recommended = recommended.slice(0, options.recommendCount);

        if (recommended.length > 0) {
            if (show) {
                for (var i=0; i < recommended.length; i++) {
                    var bgColor = (i == 0) ? 'rgb(117, 171, 52)' : 'rgb(146, 252, 122)';
                    var fontSize = ((i + 1).toString().length < 2) ? '11pt' : '9pt';

                    $(recommended[i].elem).append(
                        $('<div>')
                            .addClass('cookie-assist-recommend')
                            .css('display', 'inline-block')
                            .css('min-width', '15px')
                            .css('height', '15px')
                            .css('position', 'relative')
                            .css('top', '8px')
                            .css('left', '5px')
                            .css('background-color', bgColor)
                            .css('border-radius', '7px')
                            .css('box-shadow', `0 0 20px 10px ${bgColor}`)
                            .css('border', '1px solid rgba(0, 0, 0, 0.8)')
                            .css('text-align', 'center')
                            .css('vertical-align', 'middle')
                            .css('color', 'black')
                            .css('font-size', fontSize)
                            .text(i + 1)
                    );
                }
            }

            var currentCookies = parseShortNumber(
                $('#cookies')
                    .contents()
                    .filter(function() {
                        return this.nodeType === 3; //Node.TEXT_NODE
                    })
                    .text()
            );

            var remainingCookies = recommended[0].price - currentCookies;
            var cpsProdAverage = cpsProd.movingAverage();

            if (remainingCookies > 0 && cpsProdAverage > 0) {
                var now = new Date();
                var eta = new Date(now.getTime());
                eta.setSeconds(eta.getSeconds() + remainingCookies / cpsProdAverage);

                var timeStr = '';
                var timeSuffix = 'AM';

                if (eta.getHours() == 0)
                    timeStr += '12';
                else if (eta.getHours() == 12) {
                    timeStr += '12';
                    timeSuffix = 'PM';
                }
                else if (eta.getHours() > 12) {
                    timeStr += (eta.getHours() - 12);
                    timeSuffix = 'PM';
                }
                else
                    timeStr += eta.getHours();

                function digit2(x) {
                    return (x < 10) ? '0' + x : '' + x;
                }
                
                timeStr += `:${digit2(eta.getMinutes())} ${timeSuffix}`;

                var dateStr = '';
                
                const monthNames = [ 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec' ];
                var monthStr = monthNames[eta.getMonth()];
                
                if (eta.getFullYear() != now.getFullYear()) {
                    // full date including year
                    dateStr = ` on ${monthStr} ${eta.getDate()}, ${eta.getFullYear()}`;
                }
                else if (eta.getMonth() != now.getMonth()) {
                    // date excluding year
                    dateStr = ` on ${monthStr} ${eta.getDate()}`;
                }
                else if (eta.getDate() != now.getDate()) {
                    if (eta.getDate() == now.getDate() + 1) {
                        dateStr = ' tomorrow';
                    }
                    else {
                        // date excluding year
                        dateStr = ` on ${monthStr} ${eta.getDate()}`;
                    }
                }

                $eta.text(`[ETA: ${timeStr}${dateStr}]`);
            }
        }

        if (recommended.length != lastRecommended.length && 
            (recommended.length == 0 || lastRecommended.length == 0 || recommended[0].name != lastRecommended[0].name))
        {
            log.info('now recommending:');
            recommended.forEach((product) => { logProduct(product, log.info); });
        }

        lastRecommended = recommended;
        return recommended;
    }

    var flags = {};

    $('.product,.upgrade').not('.noFrame').click(function() {
        if (flags.recommend || flags.purchase) {
            updateRecommendation(flags.recommend);
        }
        else {
            clearRecommendation();
        }
    });

    // compute mouse clicks per second
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

        // get production CpS
        cpsProd.addSample((function() {
            var text = $('#cookiesPerSecond').text();
            var m = null;

            if ((m = text.match(/per second: (.*)/)) != null)
            {
                return parseShortNumber(m[1]);
            }
        })());

        log.debug(`Production CpS: latest=${cpsProd.latest()}, moving average=${cpsProd.movingAverage()}`);

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
                var recommended = updateRecommendation(flags.recommend);

                if (flags.purchase && recommended.length > 0 && recommended[0].enabled) {
                    log.info(`purchasing ${recommended[0].name} @ ${recommended[0].cpsEachPerPrice} CpS per price`);
                    $(recommended[0].elem).click();
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
    addFlagToMenu('purchase', 'purchase top recommendation');

    $assist.append($eta);

    $('#topBar').children().css('display', 'none');
    $("#topBar").append($assist);

    log.info(`Loaded version ${version}`);

    // exports
    window.CookieAssist = window.CookieAssist || {};
    $.extend(window.CookieAssist, {
        version: version,
        flags: flags,
        options: options,
    });

})(jQuery);
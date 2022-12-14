(function($) {

    const version = '{{FULL_VERSION}}';
    const shortVersion = '{{VERSION}}';

    var flags = {};

    const recommendAlgos = {
        CpSPerPrice: 'CpS/P',
        CpSPerPricePreferNewBuildings: 'CpS/P, PNB',
        CpSPerPricePreferNewBuildingsOverUpgrades: 'CpS/P, PNBOU',
        CpSPerPricePreferNewUpgrades: 'CpS/P, PNU',
        CpSPerPricePreferNewUpgradesOverBuildings: 'CpS/P, PNUOB',
        CpSPerPricePerTTE: 'CpS/P/TTE',
        Price: 'P',
        InversePrice: '1/P',
    };

    const purchaseAlgos = {
        Top: 'Top',
        BestAvailable: 'Best Available'
    };
    
    var options = {
        recommendCount: 5,
        recommendAlgo: recommendAlgos.CpSPerPrice,
        purchaseAlgo: purchaseAlgos.Top,
        maxWrinklerCount: 9,
    };

    const log = (function(){
        function makeLogFunction(consoleFunc) {
            return function(msg) {
                return consoleFunc(`[CookieAssist] ${msg}`);
            };
        }

        return {
            debug: makeLogFunction((msg) => { if (flags.debugLogs) console.debug(msg); }),
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

    // change styles
    (function() {
        // Create the <style> tag
        var style = document.createElement("style");
    
        // Add a media (and/or media query) here if you'd like!
        // style.setAttribute("media", "screen")
        // style.setAttribute("media", "only screen and (max-width : 1024px)")
    
        // WebKit hack :(
        style.appendChild(document.createTextNode(""));
    
        // Add the <style> element to the page
        document.head.appendChild(style);
    
        // make wrinkled CpS easier to read
        style.sheet.insertRule('.wrinkled { color: rgb(255, 153, 171) !important; background-color: rgb(204, 0, 0); }');
    })();

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
                    'thousand',             // 10^3
                    'million',              // 10^6
                    'billion',              // 10^9
                    'trillion',             // 10^12
                    'quadrillion',          // 10^15
                    'quintillion',          // 10^18
                    'sextillion',           // 10^21
                    'septillion',           // 10^24
                    'octillion',            // 10^27
                    'nonillion',            // 10^30
                    'decillion',            // 10^33
                    'undecillion',          // 10^36
                    'duodecillion',         // 10^39
                    'tredecillion',         // 10^42
                    'quattuordecillion',    // 10^45
                    'quindecillion',        // 10^48
                    'sexdecillion',         // 10^51
                    'septendecillion',      // 10^54
                    'octodecillion',        // 10^57
                    'novemdecillion',       // 10^60
                    'vigintillion',         // 10^63
                    'unvigintillion',       // 10^66
                    'duovigintillion',      // 10^69
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

    var $mainMenu = $('<span>');
    var $grandmaMenu = $('<span>')
        .css('display', 'none');
    var $settingsMenu = $('<span>')
        .css('display', 'none');

    var $eta = $('<span>')
        .css('margin-left', '10px');

    var lastRecommended = [];
    var cpsProd = (function() {
        var count = 0;
        var samples = new Array(5000);
        var sum = 0;
        var latest = NaN;
        var latestRaw = NaN;
        var latestIsBuffed = false;
        var latestIsWrinkled = false;

        return {
            raw: function() {
                return latestRaw;
            },
            isBuffed: function() {
                return latestIsBuffed;
            },
            isWrinkled: function() {
                return latestIsWrinkled;
            },
            unwrinkled: function() {
                return latestIsWrinkled ? latestRaw : latest;
            },
            latest: function() {
                return latest;
            },
            addSample: function(current, raw, isBuffed, isWrinkled) {
                latest = current;
                latestRaw = raw;
                latestIsBuffed = isBuffed;
                latestIsWrinkled = isWrinkled;
                if (current == null)
                    return;
                sum += current;
                var expireVal = samples[count % samples.length];
                samples[count % samples.length] = current;
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
        var automationState = null;

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
            },
            enableAutomationMode: function(enable = true) {
                if (enable && !automationState) {
                    automationState = {
                        originalTooltipOn: Game.tooltip.on,
                        originalTooltip: Game.tooltip.tt,
                        originalTooltipAnchor: Game.tooltip.tta,
                        originalMouseDown: Game.mouseDown,
                        fakeTooltipElem: $('<div>')[0],
                        fakeTooltipAnchorElem: $('<div>')[0],
                    };

                    // direct game's tooltip element to a fake one
                    Game.tooltip.tt = automationState.fakeTooltipElem;
                    Game.tooltip.tta = automationState.fakeTooltipAnchorElem;

                    // temporarily suspend mouse down behavior
                    Game.mouseDown = 0;
                }
                else if (!enable && automationState) {
                    Game.tooltip.tt = automationState.originalTooltip;
                    Game.tooltip.tta = automationState.originalTooltipAnchor;
                    Game.tooltip.on = automationState.originalTooltipOn;
                    Game.mouseDown = automationState.originalMouseDown;
                    automationState = null;
                }
            },
            tooltipQuery: function() {
                return $(Game.tooltip.tt);
            },
        };
    })();

    function clearRecommendation() {
        $('.product,.upgrade').not('.noFrame').find('.cookie-assist-recommend').remove();
        $eta.empty();
    }

    function updateRecommendation(show) {
        var $originalTooltipSubject = gameTooltipHook.subjectQuery();

        gameTooltipHook.enableAutomationMode(true);
        var $tooltip = gameTooltipHook.tooltipQuery();

        $originalTooltipSubject.mouseout();

        var knownProducts = [];
        var unknownProducts = [];
        var ignoredProducts = [];

        function addProduct(product) {
            // avoid switches and warnings
            if (product.warning || product.type == 'Switch') {
                ignoredProducts.push(product);
                return;
            }

            if (product.cpsEach >= 0 && product.price) {
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
                    product.cpsEach = cpsProd.unwrinkled() * product.addedProdMult;
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
                    product.cpsEach = cpsProd.unwrinkled() * product.addedProdMult * averageMouseClicksPerSecond;
                }
            });
            
            addProduct(product);
        });

        // calculate grandma boosts
        if (grandmas && grandmas.owned > 0 && grandmas.price && grandmas.cpsEach >= 0 && grandmas.buildingBoostPcts) {
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
        gameTooltipHook.enableAutomationMode(false);
        $originalTooltipSubject.mouseover();

        knownProducts.sort((a, b) => { return a.name.localeCompare(b.name); });
        unknownProducts.sort((a, b) => { return a.name.localeCompare(b.name); });
        ignoredProducts.sort((a, b) => { return a.name.localeCompare(b.name); });

        log.debug('known products:');
        knownProducts.forEach((product) => { logProduct(product, log.debug); });
        log.debug('unknown products:');
        unknownProducts.forEach((product) => { logProduct(product, log.debug); });
        log.debug('ignored products:');
        ignoredProducts.forEach((product) => { logProduct(product, log.debug); });

        clearRecommendation();

        recommended = [];

        if (options.recommendAlgo == recommendAlgos.Price || options.recommendAlgo == recommendAlgos.InversePrice) {
            recommended = [].concat(knownProducts).concat(unknownProducts);

            if (options.recommendAlgo == recommendAlgos.Price)
                recommended.sort((a, b) => { return b.price - a.price; });
            else // InversePrice
                recommended.sort((a, b) => { return (1 / b.price) - (1 / a.price); });
        }
        else {
            if (options.recommendAlgo == recommendAlgos.CpSPerPricePerTTE)
                knownProducts.sort((a, b) => {
                    var aTTE = a.price / cpsProd.unwrinkled();
                    var bTTE = b.price / cpsProd.unwrinkled();
                    return b.cpsEachPerPrice / bTTE - a.cpsEachPerPrice / aTTE;
                });
            else
                knownProducts.sort((a, b) => { return b.cpsEachPerPrice - a.cpsEachPerPrice; });

            // recommend the products with the highest CpS per price
            recommended = knownProducts.slice();

            unknownProducts.sort((a, b) => { return a.price - b.price; });

            if (options.recommendAlgo == recommendAlgos.CpSPerPricePreferNewBuildings ||
                options.recommendAlgo == recommendAlgos.CpSPerPricePreferNewBuildingsOverUpgrades ||
                options.recommendAlgo == recommendAlgos.CpSPerPricePreferNewUpgrades ||
                options.recommendAlgo == recommendAlgos.CpSPerPricePreferNewUpgradesOverBuildings) {
                var newProductFilter = null;

                if (options.recommendAlgo == recommendAlgos.CpSPerPricePreferNewBuildings || 
                    options.recommendAlgo == recommendAlgos.CpSPerPricePreferNewBuildings)
                    newProductFilter = (product) => { return product.type == 'Building'; };
                else
                    newProductFilter = (product) => { return product.type != 'Building'; };

                var newProducts = unknownProducts.filter(newProductFilter);
                recommended = newProducts.concat(recommended);

                if (newProducts.length > 0) {
                    if (options.recommendAlgo == recommendAlgos.CpSPerPricePreferNewBuildings || 
                        options.recommendAlgo == recommendAlgos.CpSPerPricePreferNewUpgrades)
                        unknownProducts = unknownProducts.filter((product) => { return !newProductFilter(product); });
                    else // CpSPerPricePreferNewBuildingsOverUpgrades or CpSPerPricePreferNewUpgradesOverBuildings
                        unknownProducts = [];
                }
            }

            // prefer an unknown product if it is cheaper
            if (unknownProducts.length > 0 && 
                (recommended.length == 0 || unknownProducts[0].price < recommended[0].price)) {
                recommended.unshift(unknownProducts[0]);

                unknownProducts.slice(1).forEach((product) => { recommended.push(product); });
            }
            else {
                unknownProducts.forEach((product) => { recommended.push(product); });
            }
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
    var firstActionTimestamp = null;
    var lastCpsLoggedTimestamp = null;
    var cpsLogData = [];
    
    var interval = window.setInterval(function() {

        var now = new Date();
        iterCount++;

        // get production CpS
        cpsProd.addSample(
            (function() {
                var text = $('#cookiesPerSecond').text();
                var m = null;

                if ((m = text.match(/per second: (.*)/)) != null)
                {
                    return parseShortNumber(m[1]);
                }
            })(), 
            Game.cookiesPsRaw, 
            exists($('.crate.enabled.buff')),
            $('#cookiesPerSecond').hasClass('wrinkled'));

        log.debug(`Production CpS: latest=${cpsProd.latest()}, moving average=${cpsProd.movingAverage()}`);

        var actionPerformed = (function() {
            log.debug('computing action');

            if (flags.goldenCookie || flags.wrathCookie) {
                var $shimmer = $('.shimmer')
                    // ignore wrath cookies
                    .filter(function() {
                        var isWrathCookie = $(this).css('background').indexOf('wrath') >= 0;
                        if (flags.wrathCookie && flags.goldenCookie)
                            return true;
                        else if (flags.wrathCookie) // only wrath cookies
                            return isWrathCookie;
                        else // only golden cookies
                            return !isWrathCookie;
                    })
                    // select first result
                    .first();

                if (exists($shimmer))
                {
                    log.info('clicking golden cookie');
                    $shimmer.click();
                    return true;
                }
            }

            if (flags.popWrinkler) {
                var activeWrinklers = Game.wrinklers.filter((wrinkler) => { return wrinkler.close == 1; });

                if (activeWrinklers.length > options.maxWrinklerCount) {
                    //var oldestWrinkler = activeWrinklers.sort((a, b) => { return b.sucked - a.sucked; })[0];
                    log.info('popping random wrinkler');
                    Game.PopRandomWrinkler();
                    return true;
                }
            }

            if (flags.recommend || flags.purchase) {
                if (iterCount % 20 == 0) {
                    var recommended = updateRecommendation(flags.recommend);
                    var purchaseProduct = null;

                    if (flags.purchase) {
                        var n = options.purchaseAlgo == purchaseAlgos.BestAvailable ? recommended.length : 1;

                        for (var i=0; i < n; i++) {
                            if (recommended[i].enabled) {
                                purchaseProduct = recommended[i];
                                break;
                            }
                        }

                        if (purchaseProduct) {
                            log.info(`purchasing ${purchaseProduct.name} @ ${purchaseProduct.cpsEachPerPrice} CpS per price`);
                            $(purchaseProduct.elem).click();
                            return true;
                        }
                    }
                }
            }
            else {
                clearRecommendation();
            }

            if (flags.bigCookie) {
                log.debug('clicking big cookie');
                $('#bigCookie').click();
                return true;
            }
        })();

        if (flags.logCps) {
            function maybeLogCurrentCps() {
                var cps = cpsProd.raw();

                if (cpsLogData.length > 0 && Math.abs(cpsLogData[cpsLogData.length - 1][1] - cps) < 0.9)
                    return;

                cpsLogData.push([
                    (now - firstActionTimestamp) / 1000,
                    cps,
                ]);
                lastCpsLoggedTimestamp = now;
            }
    
            if (actionPerformed && !firstActionTimestamp)
                firstActionTimestamp = now;
    
            if (firstActionTimestamp) {
                if (lastCpsLoggedTimestamp) {
                    var secondsSinceLastLog = (now - lastCpsLoggedTimestamp) / 1000;
                    if (secondsSinceLastLog >= 2)
                        maybeLogCurrentCps();
                }
                else
                    maybeLogCurrentCps();
            }
        }
    }, 100);

    function addFlagToMenu(name, label, $menu = $mainMenu) {
        $menu.append(
            $(`<input type="checkbox" id="cookie-assist-flag-${name}">`)
                .css('margin-left', '10px')
                .change(function() {
                    flags[name] = $(this).is(":checked");
                    log.info(`flag ${name} ${flags[name] ? 'enabled' : 'disabled'}`);
                })
        );
    
        $menu.append(
            $(`<label for="cookie-assist-flag-${name}">${label}</label>`)
        );
    }

    addFlagToMenu('bigCookie', 'click big cookie');
    addFlagToMenu('goldenCookie', 'click golden cookies');
    addFlagToMenu('recommend', 'show recommendations');

    $settingsMenu.append($('<span>recommend:</span>').css('margin-left', '10px'));

    $settingsMenu.append($('<select>')
        .append('<option>5</option>')
        .append('<option>10</option>')
        .append('<option>25</option>')
        .append('<option>99</option>')
        .css('margin-left', '5px')
        .change(function() {
            options.recommendCount = parseInt($(this).val());
        })
    );

    var $recommendAlgoSelect = $('<select>')
        .css('margin-left', '5px')
        .change(function() {
            options.recommendAlgo = $(this).val();
        });
    
    $settingsMenu.append($recommendAlgoSelect);

    $.each(recommendAlgos, function( name, value ) {
        $recommendAlgoSelect.append(
            $(`<option value="${value}"${value == options.recommendAlgo ? ' selected' : ''}>${value}${value == options.recommendAlgo ? ' (default)' : ''}</option>`)
        );
    });

    addFlagToMenu('purchase', 'purchase recommendations');

    $settingsMenu.append($('<span>purchase:</span>').css('margin-left', '10px'));

    var $purchaseAlgoSelect = $('<select>')
        .css('margin-left', '5px')
        .change(function() {
            options.purchaseAlgo = $(this).val();
        });

    $.each(purchaseAlgos, function( name, value ) {
        $purchaseAlgoSelect.append(
            $(`<option value="${value}"${value == options.purchaseAlgo ? ' selected' : ''}>${value}${value == options.purchaseAlgo ? ' (default)' : ''}</option>`)
        );
    });
    
    $settingsMenu.append($purchaseAlgoSelect);

    $mainMenu.append($eta);

    $assist.append($mainMenu);

    function toggleMenu($thisMenu, $thisMenuToggle, otherMenuToggles = []) {
        var isMenuVisible = $thisMenu.css('display') != 'none';

        $thisMenuToggle.css('display', '');
        $thisMenu.css('display', isMenuVisible ? 'none' : '');
        $mainMenu.css('display', isMenuVisible ? '' : 'none');

        otherMenuToggles.forEach(($toggle) => {
            $toggle.css('display', isMenuVisible ? '' : 'none');
        });
    }

    var $grandmaMenuToggle = $('<a href="#">????????</a>')
        .attr('title', 'Grandmapocalypse')
        .css('text-decoration', 'none')
        .css('margin-left', '15px')
        .click(function() {
            toggleMenu($grandmaMenu, $grandmaMenuToggle, [ $settingsMenuToggle ]);
        });

    $assist.append($grandmaMenuToggle);

    addFlagToMenu('wrathCookie', 'click wrath cookies', $grandmaMenu);
    addFlagToMenu('popWrinkler', 'pop wrinklers', $grandmaMenu);

    $settingsMenu.append($('<span>wrinklers:</span>').css('margin-left', '10px'));

    var $maxWrinklerSelect = $('<select>')
        .css('margin-left', '5px')
        .change(function() {
            options.maxWrinklerCount = parseInt($(this).val());
        });
    
    $settingsMenu.append($maxWrinklerSelect);

    for (var i=0; i <= 12; i++) {
        $maxWrinklerSelect.append(
            $(`<option value="${i}"${i == options.maxWrinklerCount ? ' selected' : ''}>${i}${i == options.maxWrinklerCount ? ' (default)' : ''}</option>`)
        );
    }

    $assist.append($grandmaMenu);

    var $settingsMenuToggle = $('<a href="#">??????</a>')
        .attr('title', 'Settings')
        .css('text-decoration', 'none')
        .css('margin-left', '15px')
        .click(function() {
            toggleMenu($settingsMenu, $settingsMenuToggle, [ $grandmaMenuToggle ]);
        });
    
    $assist.append($settingsMenuToggle);

    addFlagToMenu('logCps', 'Log CpS', $settingsMenu);

    function downloadCsv (data, filename) {

        // Creating a Blob for having a csv file format
        // and passing the data with type
        const blob = new Blob([data], { type: 'text/csv' });
    
        // Creating an object for downloading url
        const url = window.URL.createObjectURL(blob)
    
        // Creating an anchor(a) tag of HTML
        const a = document.createElement('a')
    
        // Passing the blob downloading url
        a.setAttribute('href', url)
    
        // Setting the anchor tag attribute for downloading
        // and passing the download file name
        a.setAttribute('download', filename);
    
        // Performing a download with click
        a.click()
    }

    $settingsMenu.append($('<a href="#">[CSV]</a>')
        .css('margin-left', '5px')
        .click(function() {
            var csv = [
                'Seconds since first action',
                'CpS (raw)'
            ].join(',');
    
            cpsLogData.forEach((item) => {
                csv += `\n${item.join(',')}`
            });
    
            var bakeryName = (function() {
                var text = $('#bakeryName').text();
                var m = null;
    
                if ((m = text.match(/(.*)'s bakery/)) != null) {
                    return `${m[1].replace(/[&/#,+()$~%.'":*?<>{} ]/g, '')}sBakery`;
                }
    
                return null;
            })();
    
            downloadCsv(csv, `cpsLog${ bakeryName ? '-' + bakeryName : '' }.csv`);
        })
    );

    addFlagToMenu('debugLogs', 'Debug Logs', $settingsMenu);

    $assist.append($settingsMenu);

    $('#topBar').children().css('display', 'none');
    $("#topBar").append($assist);

    log.info(`Loaded version ${version}`);

    // exports
    window.CookieAssist = window.CookieAssist || {};
    $.extend(window.CookieAssist, {
        version: version,
        flags: flags,
        options: options,
        recommendAlgos: recommendAlgos,
        purchaseAlgos: purchaseAlgos,
    });

})(jQuery);
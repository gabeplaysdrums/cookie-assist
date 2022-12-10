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

    var $assist = $('<div>')
        .attr('id', 'cookie-assist')
        .css('display', 'inline-block')
        .css('padding', '5px')
        .css('margin', '2px')
        .css('color', '#fff')
        .append($(`<b>Cookie Assistant v${version}:</b> `));

    var flags = {};
    
    var interval = window.setInterval(function() {

        log.debug('computing action');

        if (flags.goldenCookie)
        {
            var $shimmer = $('.shimmer').first();

            if (exists($shimmer))
            {
                log.info('clicking golden cookie');
                $shimmer.click();
                return;
            }
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
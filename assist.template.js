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

    var $assist = $('<div>')
        .attr('id', 'cookie-assist')
        .css('display', 'inline-block')
        .css('padding', '5px')
        .css('margin', '2px')
        .css('color', '#fff')
        .append($(`<b>Cookie Assistant v${version}:</b> `));

    (function(){
        var interval = null;

        $assist.append(
            $('<input type="checkbox" id="cookie-assist-click-cookie">')
                .css('margin-left', '10px')
                .change(function() {
                    if ($(this).is(":checked")) {
                        interval = window.setInterval(function(){
                            $('#bigCookie').click();
                        }, 100);
                    }
                    else
                    {
                        window.clearInterval(interval);
                    }
                })
        );
    
        $assist.append(
            $('<label for="cookie-assist-click-cookie">click big cookie</label>')
        );
    })();

    $('#topBar').children().css('display', 'none');
    $("#topBar").append($assist);

    log.info(`Loaded version ${version}`);

    $.extend(window.CookieAssist, {
        version: version
    });

})(jQuery);
(function() {

  var IP_V6 = /(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]).){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]).){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))/g;
  var IP_V4 = /((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])/;

  var botsVsWikipediansRanges = [];
  var anonsVsLoggedInsRanges = [];
  var botCounterDivs = [];
  var botsVsWikipedians = {};
  var anonsVsLoggedIns = {};
  var botCounter = {};

  var contentDivBotsVsWikipedians =
      document.querySelector('#content-bots-vs-wikipedians');
  var contentDivAnonsVsLoggedIns =
      document.querySelector('#content-anons-vs-logged-ins');
  var contentDivBotCounter = document.querySelector('#content-bot-counter');
  var considerWikidata = document.querySelector('#consider-wikidata');
  if (considerWikidata.checked) {
    document.querySelector('#wikidata-hidden-style').disabled = true;
  } else {
    document.querySelector('#wikidata-hidden-style').disabled = false;
  }

  considerWikidata.addEventListener('change', function() {
    if (!document.querySelector('.wikidata')) {
      return;
    }
    if (considerWikidata.checked) {
      document.querySelector('#wikidata-hidden-style').disabled = true;
    } else {
      document.querySelector('#wikidata-hidden-style').disabled = false;
    }
  });

  var createStatsPane = function(language, mode, measure1, measure2) {
    var div = document.createElement('div');
    div.setAttribute('class', 'stats');
    if (language === 'global') {
      div.style.marginBottom = '2em';
    }
    if (language === 'wikidata') {
      div.setAttribute('class', 'stats wikidata');
    }
    var measure1Img = document.createElement('img');
    measure1Img.src = mode === 'bots-vs-wikipedians' ? 'bots.png' : 'anons.png';
    measure1Img.setAttribute('class', 'icon');
    div.appendChild(measure1Img);
    var range = document.createElement('input');
    range.setAttribute('readonly', 'readonly');
    range.type = 'range';
    div.appendChild(range);
    range.id = language + '-' + mode + '-range';
    var measure2Img = document.createElement('img');
    measure2Img.src = mode === 'bots-vs-wikipedians' ?
        'wikipedians.png' : 'logged-ins.png';
    measure2Img.setAttribute('class', 'icon');
    div.appendChild(measure2Img);
    var logo = document.createElement('img');
    logo.src = language === 'wikidata' ? 'wikidata.png' : 'wikipedia.png';
    logo.setAttribute('class', 'icon logo');
    div.appendChild(logo);
    var lang;
    if (language !== 'global') {
      lang = document.createElement('a');
      lang.href = language === 'wikidata' ?
          'http://' + language + '.org/' :
          'http://' + language + '.wikipedia.org/';
      lang.textContent = language;
      lang.setAttribute('target', '_blank');
    } else {
      lang = document.createElement('span');
      lang.textContent = language;
    }
    div.appendChild(lang);
    var label = document.createElement('label');
    label.setAttribute('for', '#' + language + '-' + mode + '-range');
    label.id = language + '-' + mode + '-label';
    label.innerHTML = updateStatsHtml(measure1, measure2);
    div.appendChild(label);
    var fragment = document.createDocumentFragment();
    fragment.appendChild(div);
    return fragment;
  };

  var createBotsCounterPane = function(editor, languages, edits) {
    var div = document.createElement('div');
    var measureImg = document.createElement('img');
    measureImg.src = 'bots.png';
    measureImg.setAttribute('class', 'icon');
    div.appendChild(measureImg);
    var a = document.createElement('a');
    a.href = 'https://en.wikipedia.org/wiki/User:' + editor;
    a.setAttribute('target', '_blank');
    a.textContent = editor;
    div.appendChild(a);
    var stats = document.createElement('span');
    stats.id = editor.replace(/\W/g, '') + '-span';
    stats.innerHTML = updateBotsHtml(languages, edits);
    div.appendChild(stats);
    var fragment = document.createDocumentFragment();
    fragment.appendChild(div);
    return fragment;
  };

  var updateStatsHtml = function(mode, measure1, measure2) {
    if (!(measure1 + measure2)) {
      return '';
    }
    return ' <span class="nobr"><small>(' + measure1 + ' <i>vs.</i> ' +
        measure2 + ' absolute—' +
        Math.round((measure1 / (measure1 + measure2) * 100)) +
        (mode === 'bots-vs-wikipedians' ?
            '% edited by bots)' : '% edited by anons)') + '</small><span>';
  };

  var updateBotsHtml = function(languages, edits) {
    html = ' <small>(' + edits + ' edit' + (edits !== 1 ? 's' : '') +
        '—language' + (languages.length !== 1 ? 's ' : ' ');
    html += languages.map(function(language) {
      return '<a target="_blank" href="http://' + language +
          (language === 'wikidata' ? '' : '.wikipedia') +
          '.org/"' +
          (language === 'wikidata' ? ' class="wikidata"' : '') + '>' +
          language + '</a>';
    }).join(', ');
    html += ')</small>';
    return html;
  };

  setInterval(function() {
    var globalBots = 0;
    var globalWikipedians = 0;
    var globalAnons = 0;
    var globalLoggedIns = 0;

    var updateStats = function(lang, mode, measure1, measure2) {
      var range = document.querySelector('#' + lang + '-' + mode + '-range');
      range.max = measure1 + measure2;
      range.value = range.max - measure1;
      var label = document.querySelector('#' + lang + '-' + mode + '-label');
      label.innerHTML = updateStatsHtml(mode, measure1, measure2);
    };

    // Bots vs. Wikipedians
    botsVsWikipediansRanges.forEach(function(language) {
      var stats = botsVsWikipedians[language];
      updateStats(language, 'bots-vs-wikipedians', stats.bots,
          stats.wikipedians);
      globalBots += stats.bots;
      globalWikipedians += stats.wikipedians;
    });
    if (botsVsWikipedians['wikidata'] && !considerWikidata.checked) {
      globalBots -= botsVsWikipedians['wikidata'].bots;
      globalWikipedians -= botsVsWikipedians['wikidata'].wikipedians;
    }
    updateStats('global', 'bots-vs-wikipedians', globalBots, globalWikipedians);

    // Anons vs. Logged-Ins
    anonsVsLoggedInsRanges.forEach(function(language) {
      var stats = anonsVsLoggedIns[language];
      updateStats(language, 'anons-vs-logged-ins', stats.anons,
          stats.loggedIns);
      globalAnons += stats.anons;
      globalLoggedIns += stats.loggedIns;
    });
    if (anonsVsLoggedIns['wikidata'] && !considerWikidata.checked) {
      globalAnons -= anonsVsLoggedIns['wikidata'].anons;
      globalLoggedIns -= anonsVsLoggedIns['wikidata'].loggedIns;
    }
    updateStats('global', 'anons-vs-logged-ins', globalAnons, globalLoggedIns);

    // Bot Counter
    botCounterDivs.forEach(function(editor) {
      var span = document.querySelector('#' + editor + '-span');
      var stats = botCounter[editor];
      span.innerHTML = updateBotsHtml(stats.languages, stats.edits);
      if ((stats.languages.indexOf('wikidata') !== -1) &&
          (stats.languages.length === 1)) {
        span.parentNode.classList.add('wikidata');
      } else {
        span.parentNode.classList.remove('wikidata');
      }
    });
    var selector = 'div:not([class="wikidata"])';
    var botCount = ((considerWikidata.checked ?
      (contentDivBotCounter.childNodes.length) :
      (contentDivBotCounter.querySelectorAll(selector).length)) - 1);
    globalBotCounterSpan.innerHTML =
        botCount + ' bot' + (botCount !== 1 ? 's' : '') +
        ' globally <small>(' +
        globalBots + ' total edit' +
        (globalBots !== 1 ? 's' : '') + ')</small>';
  }, 500);

  contentDivBotsVsWikipedians.appendChild(createStatsPane('global',
      'bots-vs-wikipedians', 0, 0));

  contentDivAnonsVsLoggedIns.appendChild(createStatsPane('global',
      'anons-vs-logged-ins', 0, 0));

  var globalBotCounter = document.createElement('div');
  var measureImg = document.createElement('img');
  measureImg.src = 'bots.png';
  measureImg.setAttribute('class', 'icon');
  globalBotCounter.appendChild(measureImg);
  globalBotCounter.style.marginBottom = '2em';
  contentDivBotCounter.appendChild(globalBotCounter);
  globalBotCounterSpan = document.createElement('span');
  globalBotCounter.appendChild(globalBotCounterSpan)

  var source = new EventSource('/sse');

  source.addEventListener('message', function(e) {
    var data = JSON.parse(e.data);

    // Bots vs. Wikipedians
    var botsVsWikipediansId =
        '#' + data.language + '-bots-vs-wikipedians-range';
    if (!document.querySelector(botsVsWikipediansId)) {
      botsVsWikipediansRanges.push(data.language);
      botsVsWikipedians[data.language] = {
        bots: data.isBot ? 1 : 0,
        wikipedians: data.isBot ? 0 : 1
      }
      var stats = botsVsWikipedians[data.language];
      contentDivBotsVsWikipedians.appendChild(createStatsPane(
          data.language, 'bots-vs-wikipedians', stats.bots, stats.wikipedians));
    }
    if (data.isBot) {
      botsVsWikipedians[data.language].bots += 1;
    } else {
      botsVsWikipedians[data.language].wikipedians += 1;
    }

    // Anons vs. Logged-Ins
    if (!data.isBot) {
      var anonsVsLoggedInsId =
          '#' + data.language + '-anons-vs-logged-ins-range';
      IP_V4.lastIndex = 0;
      IP_V6.lastIndex = 0;
      var isAnon = IP_V4.test(data.editor) || IP_V6.test(data.editor);
      if (!document.querySelector(anonsVsLoggedInsId)) {
        anonsVsLoggedInsRanges.push(data.language);
        anonsVsLoggedIns[data.language] = {
          anons: isAnon ? 1 : 0,
          loggedIns: isAnon ? 0 : 1
        }
        var stats = anonsVsLoggedIns[data.language];
        contentDivAnonsVsLoggedIns.appendChild(createStatsPane(
              data.language,
              'anons-vs-logged-ins',
              stats.anons,
              stats.loggedIns));
      }
      if (isAnon) {
        anonsVsLoggedIns[data.language].anons += 1;
      } else {
        anonsVsLoggedIns[data.language].loggedIns += 1;
      }
    }

    // Bot Counter
    if (data.isBot) {
      var editor = data.editor.split(':')[1];
      var escapedEditor = editor.replace(/\W/g, '');
      if (!botCounter[escapedEditor]) {
        botCounterDivs.push(escapedEditor);
        contentDivBotCounter.appendChild(
            createBotsCounterPane(editor, [data.language], 1));
        botCounter[escapedEditor] = {
          edits: 1,
          languages: [data.language]
        };
      } else {
        if (botCounter[escapedEditor].languages.indexOf(data.language) === -1) {
          botCounter[escapedEditor].languages.push(data.language);
        }
        botCounter[escapedEditor].edits++;
      }
    }
  }, false);

})();
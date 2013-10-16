(function() {

  var botsVsWikipediansRanges = [];
  var anonsVsLoggedInsRanges = [];
  var botsVsWikipedians = {};
  var anonsVsLoggedIns = {};

  var contentDivBotsVsWikipedians =
      document.querySelector('#content-bots-vs-wikipedians');
  var contentDivAnonsVsLoggedIns =
      document.querySelector('#content-anons-vs-logged-ins');
  var considerWikidata = document.querySelector('#consider-wikidata');

  considerWikidata.addEventListener('change', function() {
    if (!document.querySelector('.wikidata')) {
      return;
    }
    var wikidatas = document.querySelectorAll('.wikidata');
    if (considerWikidata.checked) {
      for (var i = 0, len = wikidatas.length; i < len; i++) {
        wikidatas[i].style.display = 'block';
      }
    } else {
      for (var i = 0, len = wikidatas.length; i < len; i++) {
        wikidatas[i].style.display = 'none';
      }
    }
  });

  var createStatsPane = function(language, mode, measure1, measure2) {
    var div = document.createElement('div');
    div.setAttribute('class', 'stats');
    if (language === 'global') {
      div.style.marginBottom = '3em';
    }
    if (language === 'wikidata') {
      div.setAttribute('class', 'wikidata');
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

  setInterval(function() {
    var globalBots = 0;
    var globalWikipedians = 0;
    var globalAnons = 0;
    var globalLoggedIns = 0;

    var updateStats = function(language, mode, measure1, measure2) {
      var range = document.querySelector('#' + language + '-' + mode + '-range');
      range.max = measure1 + measure2;
      range.value = range.max - measure1;
      var label = document.querySelector('#' + language + '-' + mode + '-label');
      label.innerHTML = updateStatsHtml(mode, measure1, measure2);
    };

    // Bots vs. Wikipedians
    botsVsWikipediansRanges.forEach(function(language) {
      var stats = botsVsWikipedians[language];
      updateStats(language, 'bots-vs-wikipedians', stats.bots, stats.wikipedians);
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
      updateStats(language, 'anons-vs-logged-ins', stats.anons, stats.loggedIns);
      globalAnons += stats.anons;
      globalLoggedIns += stats.loggedIns;
    });
    if (anonsVsLoggedIns['wikidata'] && !considerWikidata.checked) {
      globalAnons -= anonsVsLoggedIns['wikidata'].anons;
      globalLoggedIns -= anonsVsLoggedIns['wikidata'].loggedIns;
    }
    updateStats('global', 'anons-vs-logged-ins', globalAnons, globalLoggedIns);
  }, 500);

  contentDivBotsVsWikipedians.appendChild(createStatsPane('global', 'bots-vs-wikipedians', 0, 0));

  contentDivAnonsVsLoggedIns.appendChild(createStatsPane('global', 'anons-vs-logged-ins', 0, 0));

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
      var isAnon = /(?:\d{1,3}\.){3}\d{1,3}/.test(data.editor);
      if (!document.querySelector(anonsVsLoggedInsId)) {
        anonsVsLoggedInsRanges.push(data.language);
        anonsVsLoggedIns[data.language] = {
          anons: isAnon ? 1 : 0,
          loggedIns: isAnon ? 0 : 1
        }
        var stats = anonsVsLoggedIns[data.language];
        contentDivAnonsVsLoggedIns.appendChild(createStatsPane(
            data.language, 'anons-vs-logged-ins', stats.anons, stats.loggedIns));
      }
      if (isAnon) {
        anonsVsLoggedIns[data.language].anons += 1;
      } else {
        anonsVsLoggedIns[data.language].loggedIns += 1;
      }
    }
  }, false);

})();

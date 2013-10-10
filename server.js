var request = require('request');
var cheerio = require('cheerio');
var irc = require('irc');
var async = require('async');

var LIST_OF_WIKIPEDIAS_URL = 'https://meta.wikimedia.org/wiki/List_of_Wikipedias';

var IRC_SERVER = 'irc.wikimedia.org';
var IRC_NICK = 'Wikipedia-Edits-SSE';
var IRC_REAL_NAME_AND_CONTACT = 'Thomas Steiner (tomac@google.com)';

var DISCARD_WIKIPEDIA_BOTS = true;

var client = new irc.Client(
    IRC_SERVER,
    IRC_NICK,
    {
      userName: IRC_NICK,
      realName: IRC_REAL_NAME_AND_CONTACT,
      floodProtection: true,
      showErrors: true,
      stripColors: true
    });

async.series({
  addErrorListener: addErrorListener,
  addJoinedListener: addJoinedListener,
  addRegisteredListener: addRegisteredListener,
  addMessageListener: addMessageListener,
  getListOfWikipedias: getListOfWikipedias,
},
function(err, results) {
  joinChannels(results.getListOfWikipedias);
});

function addErrorListener(callback) {
  client.addListener('error', function(message) {
    console.warn('IRC error: ' + message);
  });
  callback(null);
}

function addRegisteredListener(callback) {
  client.addListener('registered', function(message) {
    console.log('Connected to IRC server ' + IRC_SERVER);
    // connect to IRC channels
  });
  callback(null);
}

function joinChannels(wikipedias) {
  wikipedias.forEach(function(channel, i) {
    channel = '#' + channel + '.wikipedia';
    console.log((++i) + ') Joining channel ' + channel);
    client.join(channel);
  });
}

function getListOfWikipedias(callback) {
  request.get(LIST_OF_WIKIPEDIAS_URL, function(error, response, body) {
    if (error || response.statusCode !== 200) {
      callback('List of Wikipedias could not be loaded: ' + error);
    }
    var $ = cheerio.load(body);
    callback(null, $('td > a[class="extiw"][title$=":"]').map(function(i, el) {
      return el.attribs.title.replace(/:$/, '');
    }));
  });
}

function addJoinedListener(callback) {
  client.addListener('join', function(channel, nick, message) {
    if (nick === IRC_NICK) {
      console.log(nick + ' joined channel ' + channel);
    }
  });
  callback(null);
}

function addMessageListener(callback) {
  client.addListener('message', function(from, to, message) {
    // this is the Wikipedia IRC bot that announces live changes
    if (from !== 'rc-pmtpa') {
      return;
    }
    var components = parseMessage(message, to);
    if (!components) {
      return;
    }
    console.log(JSON.stringify(components));
  });
  callback(null);
}

function parseMessage(message, to) {
  // get the editor's username or IP address
  // the IRC log format is as follows (with color codes removed):
  // rc-pmtpa: [[Juniata River]] http://en.wikipedia.org/w/index.php?diff=516269072&oldid=514659029 * Johanna-Hypatia * (+67) Category:Place names of Native American origin in Pennsylvania
  var messageComponents = message.split(' * ');
  var articleRegExp = /\[\[(.+?)\]\].+?$/;
  var article = messageComponents[0].replace(articleRegExp, '$1');
  // discard non-article namespaces, as listed here:
  // http://www.mediawiki.org/wiki/Help:Namespaces
  // this means only listening to messages without a ':' essentially
  if (article.indexOf(':') !== -1) {
    return false;
  }
  var editor = messageComponents[1];
  // discard edits made by bots.
  // bots are identified by a B flag, as documented here
  // http://www.mediawiki.org/wiki/Help:Tracking_changes
  // (the 'b' is actually uppercase in IRC)
  //
  // bots must identify themselves by prefixing or suffixing their
  // username with "bot".
  // http://en.wikipedia.org/wiki/Wikipedia:Bot_policy#Bot_accounts
  var flagsAndDiffUrl =
      messageComponents[0].replace('[[' + article + ']] ', '').split(' ');
  var flags = flagsAndDiffUrl[0];
  if (DISCARD_WIKIPEDIA_BOTS) {
    if ((/B/.test(flags)) ||
        (/\bbot/i.test(editor)) ||
        (/bot\b/i.test(editor))) {
      return;
    }
  }
  // normalize article titles to follow the Wikipedia URLs
  article = article.replace(/\s/g, '_');
  // the language format follows the IRC room format: "#language.project"
  var language = to.substring(1, to.indexOf('.'));
  editor = language + ':' + editor;
  // diff URL
  var diffUrl = flagsAndDiffUrl[1];
  if ((diffUrl.indexOf('diff') !== -1) &&
      (diffUrl.indexOf('oldid') !== -1)) {
    var toRev = diffUrl.replace(/.*\?diff=(\d+).*/, '$1');
    var fromRev = diffUrl.replace(/.*&oldid=(\d+).*/, '$1');
    if (language === 'wikidata') {
      diffUrl = 'http://wikidata.org/w/api.php?action=compare&torev=' +
          toRev + '&fromrev=' + fromRev + '&format=json';
    } else {
      diffUrl = 'http://' + language +
          '.wikipedia.org/w/api.php?action=compare&torev=' + toRev +
          '&fromrev=' + fromRev + '&format=json';
    }
  } else {
    diffUrl = '';
  }
  // delta
  deltaAndCommentRegExp = /\(([+-]\d+)\)\s(.*?)$/;
  var delta = messageComponents[2].replace(deltaAndCommentRegExp, '$1');
  // comment
  var comment = messageComponents[2].replace(deltaAndCommentRegExp, '$2');
  // language cluster URL
  var languageClusterUrl;
  if (language === 'wikidata') {
    languageClusterUrl = 'http://www.wikidata.org/w/api.php?' +
        'action=wbgetentities&props=sitelinks&format=json&ids=' + article;
  } else {
    languageClusterUrl = 'http://' + language +
        '.wikipedia.org/w/api.php?action=query&prop=langlinks' +
        '&format=json&lllimit=500&titles=' + article;
  }
  return {
    article: article,
    editor: editor,
    language: language,
    delta: delta,
    comment: comment,
    diffUrl: diffUrl,
    languageClusterUrl: languageClusterUrl
  };
}
'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; })();

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _slackClient = require('slack-client');

var _slackClient2 = _interopRequireDefault(_slackClient);

var _superagent = require('superagent');

var _superagent2 = _interopRequireDefault(_superagent);

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Jabbot = (function (_Slack) {
  _inherits(Jabbot, _Slack);

  /**
   * @constructor
   * @param {Object} params Jabbot options
   * @param {String} params.name Jabbot name
   * @param {String} params.token Slack token
   * @param {String} params.api Jabwire API key
   * @param {String} params.api Jabwire project id
   */

  /**
   * @property {String} Jabwire URL schema
   */

  /**
   * @property {String} Regex to detect if a Jabwire link is posted
   */

  function Jabbot() {
    _classCallCheck(this, Jabbot);

    var params = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
    // Default `autoReconnect` and `autoMark` to `true`

    var _this5 = _possibleConstructorReturn(this, Object.getPrototypeOf(Jabbot).call(this, params.token, true, true));

    _this5.mention = 'jabwire.com/projects/(.*?)/(bugs|sprint_tasks)/(\\d+)';
    _this5.shorthand = '\\b(bug|sprint(?:\\s+)?task|task)(?:\\s+)?(?:#)?(\\d+)\\b';
    _this5.jabwire = 'https://www.jabwire.com/projects/{project}/{type}/{id}';
    _this5.types = {
      'sprint_tasks': 'Sprint Task',
      'bugs': 'Bug'
    };

    if (!params.api) {
      throw new Error('Jabwire API token required');
    } else if (!params.project) {
      throw new Error('Jabwire project id required');
    }

    _this5.api = params.api;
    _this5.project = params.project;

    // Listen to all incoming messages
    _this5.on('message', _this5.checkMessage.bind(_this5));

    _this5.login();
    return _this5;
  }

  /**
   * Message event handler
   * @param {Object} event
   */

  /**
   * @property {Object} Simple dictionary of raw types with human readable
   *   values
   */

  /**
   * @property {String} Regex to detect if a Jabwire short hand is posted
   *   like "Bug #1234" and "Sprint Task #12312"
   */

  _createClass(Jabbot, [{
    key: 'checkMessage',
    value: function checkMessage(event) {
      var _this = this;

      if (this.isValidMessage(event)) {
        (function () {
          var text = event.text;
          var channel = event.channel;

          var message = text.toLowerCase();

          // Match for multiple tickets before breaking down
          var global = new RegExp(_this.mention, 'g');
          var local = new RegExp(_this.mention);

          // Match multiple occurances
          _this.getMatches(message).forEach(function (partial) {
            var _getTicketMatches = _this.getTicketMatches(partial);

            var project = _getTicketMatches.project;
            var type = _getTicketMatches.type;
            var id = _getTicketMatches.id;

            _this.sendTicket(channel, project, type, id).then(function (message) {
              _this.emit('send', message);
            }).catch(function (e) {
              _this.emit('failed', message);
            });
          });
        })();
      }
    }

    /**
     * Attempt to match message with either a url mention or a text mention
     * @param {String} message
     * @return {Array} Any possible matches
     */

  }, {
    key: 'getMatches',
    value: function getMatches(message) {
      return message.match(new RegExp(this.mention, 'ig')) || message.match(new RegExp(this.shorthand, 'ig'));
    }

    /**
     * Attempt Jabwire ticket data out of the message, it can either be a
     * url or from a string (e.g Bug 1234)
     * @param {String} message
     * @return {Object}
     */

  }, {
    key: 'getTicketMatches',
    value: function getTicketMatches(message) {
      return this.getMatchesFromUrl(message) || this.getMatchesFromString(message);
    }

    /**
     * Attempt to pull the ticket info as a URL from message
     * @param {String} [message = '']
     * @return {Object|Undefined}
     */

  }, {
    key: 'getMatchesFromUrl',
    value: function getMatchesFromUrl() {
      var message = arguments.length <= 0 || arguments[0] === undefined ? '' : arguments[0];

      var _ref = message.match(new RegExp(this.mention)) || [];

      var _ref2 = _slicedToArray(_ref, 4);

      var match = _ref2[0];
      var project = _ref2[1];
      var type = _ref2[2];
      var id = _ref2[3];

      if (match) {
        return {
          project: project,
          type: type,
          id: id
        };
      }

      return match;
    }

    /**
     * Attempt to pull the ticket info as a string from message
     * @param {String} [message = '']
     * @return {Object|Null}
     */

  }, {
    key: 'getMatchesFromString',
    value: function getMatchesFromString() {
      var message = arguments.length <= 0 || arguments[0] === undefined ? '' : arguments[0];

      var _ref3 = message.match(new RegExp(this.shorthand, 'i')) || [];

      var _ref4 = _slicedToArray(_ref3, 3);

      var match = _ref4[0];
      var type = _ref4[1];
      var id = _ref4[2];

      if (match) {
        return {
          project: this.project,
          type: /bug/i.test(type) ? 'bugs' : 'sprint_tasks',
          id: id
        };
      }

      return match;
    }

    /**
     * Get the Jabwire ticket
     * @param {String} project
     * @param {String} type
     * @param {String} id
     * @return {Promise}
     */

  }, {
    key: 'getTicket',
    value: function getTicket(project, type, id) {
      var _this2 = this;

      return new _bluebird2.default(function (resolve, reject) {
        var url = _this2.buildUrl(project, type, id);

        _superagent2.default.get(url + '.json').query({
          apikey: _this2.api
        }).end(function (error, response) {
          if (error) {
            reject(error);
          } else if (response.statusCode === 200) {
            resolve(response.body);
          } else {
            reject(response);
          }
        });
      });
    }

    /**
     * Send ticket to channel supplied channel
     * @param {String} channel Slack medium (group or channel)
     * @param {String} project Jabwire project id
     * @param {String} type Ticket type (`bugs` or `sprint_tasks`)
     * @param {String} id Ticket id
     * @return {Promise}
     */

  }, {
    key: 'sendTicket',
    value: function sendTicket(channel, project, type, id) {
      var _this3 = this;

      return this.getTicket(project, type, id).then(function (ticket) {
        var params = {
          'icon_url': 'http://imgur.com/UeMdM9p.png',
          'attachments': _this3.buildTicketAttachments(ticket, project, type, id)
        };

        return _this3.postToChannel(channel, '', params).then(function (response) {
          return {
            response: response,
            ticket: _extends({}, ticket, {
              type: type,
              project: project
            }),
            params: _extends({}, params, {
              attachments: JSON.parse(params.attachments)
            })
          };
        });
      });
    }

    /**
     * Post message to the channel
     * @param {String} channel The channel, group, or DM
     * @param {String} text Message to send
     * @param {Object} params Additional message parameters
     * @return {Promise.<String, Error>} Returns API response
     */

  }, {
    key: 'postToChannel',
    value: function postToChannel(channel, text) {
      var _this4 = this;

      var params = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

      return new _bluebird2.default(function (resolve, reject) {
        var message = _extends({
          username: _this4.name,
          channel: channel,
          text: text
        }, params);

        _this4._apiCall('chat.postMessage', message, function (response) {
          if (response.ok) {
            resolve(response);
          } else {
            reject(response);
          }
        });
      });
    }

    /**
     * Build a message attachment
     * @param {Object} ticket
     * @param {String} project
     * @param {String} type
     * @param {String} id
     * @return {String} JSON stringified attachment
     */

  }, {
    key: 'buildTicketAttachments',
    value: function buildTicketAttachments(ticket, project, type, id) {
      var url = this.buildUrl(project, type, id);
      var title = this.formatTitle(type);
      var attachment = {
        'fallback': 'Jabwire: ' + title + ' #' + id + ' - ' + url,

        'color': '#658CB2',
        'title': ticket.title,
        'title_link': url,

        'author_name': 'Jabwire: ' + title + ' #' + id,
        'author_link': url,

        'mrkdwn_in': ['text']
      };

      switch (type) {
        case 'sprint_tasks':
          attachment.text = this.buildSprintTicket(ticket);
          break;
        case 'bugs':
          attachment.text = this.buildBugTicket(ticket);
          break;
      }

      return JSON.stringify([attachment]);
    }

    /**
     * Build a bug task specific message
     * @param {Object} ticket
     * @return {String} Bug specific attachment message
     */

  }, {
    key: 'buildBugTicket',
    value: function buildBugTicket(ticket) {
      var priority = ticket.priority;
      var workflow = ticket.workflow;
      var resolution = ticket.resolution;
      var activities = ticket.activities;

      var external = activities.filter(function (activity) {
        return activity.message_type === 'external_reference';
      });

      var message = ['_Priority_: ' + capitalize(priority), '_Workflow_: ' + capitalize(workflow), '_Resolution_: ' + capitalize(resolution), '_Ticket References_: ' + external.length];

      return message.join(' | ');
    }

    /**
     * Build a sprint task specific message
     * @param {Object} ticket
     * @return {String} Sprint task specific attachment message
     */

  }, {
    key: 'buildSprintTicket',
    value: function buildSprintTicket(ticket) {
      var workflow = ticket.workflow;
      var estimate = ticket.estimate;
      var updated_at = ticket.updated_at;

      var _updated_at$match = updated_at.match(/(\d{4})-(\d{2})-(\d{2})/);

      var _updated_at$match2 = _slicedToArray(_updated_at$match, 4);

      var noop = _updated_at$match2[0];
      var year = _updated_at$match2[1];
      var month = _updated_at$match2[2];
      var day = _updated_at$match2[3];

      var message = ['_Workflow_: ' + capitalize(workflow), '_Updated_: ' + month + '/' + day + '/' + year, '_Estimate_: ' + estimate];

      return message.join(' | ');
    }

    /**
     * Check if event is a valid message to respond to
     * @param {Object} event
     * @return {Boolean} Event is valid to respond to
     */

  }, {
    key: 'isValidMessage',
    value: function isValidMessage(event) {
      return !this.isFromSelf(event) && this.isJabwireMention(event);
    }

    /**
     * Check if event is posted by the bot itself
     * @param {Object} event
     * @return {Boolean} If event is posted by itself
     */

  }, {
    key: 'isFromSelf',
    value: function isFromSelf(event) {
      return event.user === this.self.id;
    }

    /**
     * Check if the event message is a Jabwire message
     * @param {Object} event
     * @return {Boolean} If event is probably a Jabwire message
     */

  }, {
    key: 'isJabwireMention',
    value: function isJabwireMention(event) {
      var text = event.text || '';
      return text.toLowerCase().match(new RegExp(this.mention)) || text.match(new RegExp(this.shorthand, 'i'));
    }

    /**
     * Build Jabwire URL
     * @param {String} project Jabwire project
     * @param {String} type Jabwire ticket type (sprint_task or bug)
     * @param {String} id Jabwire ticket id
     * @return {String} Build Jabwire URL
     */

  }, {
    key: 'buildUrl',
    value: function buildUrl(project, type, id) {
      return this.jabwire.replace('{project}', project).replace('{type}', type).replace('{id}', id);
    }

    /**
     * Format Jabwire type
     * @param {String} type
     * @return {String} 
     */

  }, {
    key: 'formatTitle',
    value: function formatTitle(type) {
      return this.types[type];
    }
  }]);

  return Jabbot;
})(_slackClient2.default);

/**
 * Capitalize and format string
 * @return {String} String that is capitalized and without underscore
 */

exports.default = Jabbot;
function capitalize() {
  var string = arguments.length <= 0 || arguments[0] === undefined ? '' : arguments[0];

  return string.split('_').map(function (partial) {
    return partial.charAt(0).toUpperCase() + partial.slice(1);
  }).join(' ');
}

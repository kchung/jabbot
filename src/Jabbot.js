import Slackbots from 'slackbots';
import request from 'superagent';
import Promise from 'bluebird';

export default class Jabbot extends Slackbots {

  /**
   * @property {RegExp} Regex to detect if a Jabwire link is posted
   */
  mention = 'jabwire.com/projects/(.*?)/(bugs|sprint_tasks)/(\\d+)'

  /**
   * @property {String} Jabwire URL schema
   */
  jabwire = 'https://www.jabwire.com/projects/{project}/{type}/{id}'

  /**
   * @property {Object} Simple dictionary of raw types with human readable
   *   values
   */
  types = {
    'sprint_tasks': 'Sprint Task',
    'bugs': 'Bug'
  }

  /**
   * @constructor
   * @param {Object} params Jabbot options
   * @param {String} params.name Jabbot name
   * @param {String} params.token Slack token
   * @param {String} params.api Jabwire API key
   */
  constructor(params = {}) {
    super(params);
    this.api = params.api;
  }

  /**
   * Run Jabbot, listen to events
   * @return {Jabbot}
   */
  run() {
    this.on('start', this.onStart.bind(this));
    this.on('message', this.onMessage.bind(this));
    return this;
  }

  /**
   * Start event handler
   * @param {Object} event
   */
  onStart() {
    this.user = this.findUserByName(this.name);
  }

  /**
   * Message event handler
   * @param {Object} event
   */
  onMessage(event) {
    if (this.isValidEvent(event)) {
      const {text, channel} = event;
      const message = text.toLowerCase();

      // Match for multiple tickets before breaking down
      const global = new RegExp(this.mention, 'g');
      const local = new RegExp(this.mention);

      // Match multiple occurances
      message.match(global).forEach((partial) => {
        const [noop, project, type, id] = partial.match(local);
        this.sendTicket(channel, project, type, id)
          .then((message) => {
            this.emit('send', message);
          })
          .catch((e) => {
            this.emit('failed', message);
          });
      });
    }
  }

  /**
   * Get the Jabwire ticket
   * @param {String} project
   * @param {String} type
   * @param {String} id
   * @return {Promise}
   */
  getTicket(project, type, id) {
    return new Promise((resolve, reject) => {
      const url = this.buildUrl(project, type, id);

      request.get(url + '.json')
        .query({
          apikey: this.api
        })
        .end((error, response) => {
          if (error) {
            reject(error);
          }
          else if (response.statusCode === 200) {
            resolve(response.body);
          }
          else {
            reject(response);
          }
        });
    });
  }

  /**
   * Send ticket to channel supplied channel
   * @param {String} channel
   * @param {String} project
   * @param {String} type
   * @param {String} id
   * @return {Promise}
   */
  sendTicket(channel, project, type, id) {
    return this.getTicket(project, type, id)
      .then((ticket) => {
        const params = {
          'icon_url': 'http://imgur.com/UeMdM9p.png',
          'attachments': this.buildTicketAttachments(ticket, project, type, id)
        };

        return this.postToMedium(channel, '', params)
          .then((name) => {
            return {
              ticket: {
                ...ticket,
                type: type,
                project: project
              },
              room: name,
              params: {
                ...params,
                attachments: JSON.parse(params.attachments)
              }
            }
          });
      });
  }

  /**
   * Post message to an auto-detected medium (channel or group)
   * @param {String} medium The channel or group name (usually starts with
   *   a 'G' for group and 'C' for channel.
   * @param {String} text Message to send
   * @param {Object} params
   * @return {Promise.<String, Error>} Returns the name of the medium when
   *   sent.
   */
  postToMedium(medium, text, params) {
    const {name} = this.findMediumById(medium);
    const message = medium[0] === 'G'
      ? this.postMessageToGroup
      : this.postMessageToChannel

    return message.apply(this, [name, text, params])
      .then(() => {
        return name;
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
  buildTicketAttachments(ticket, project, type, id) {
    const url = this.buildUrl(project, type, id);
    const title = this.formatTitle(type);
    const attachment = {
      'fallback': `Jabwire: ${title} #${id} - ${url}`,

      'color': '#658CB2',
      'title': ticket.title,
      'title_link': url,

      'author_name': `Jabwire: ${title} #${id}`,
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
  buildBugTicket(ticket) {
    const {priority, workflow, resolution, activities} = ticket;

    const external = activities.filter((activity) => {
      return activity.external_ref !== null;
    });

    const message = [
      `_Priority_: ${priority}`,
      `_Workflow_: ${workflow}`,
      `_Resolution_: ${resolution}`,
      `_External Activity_: ${external.length}`
    ];

    return message.join(' | ');
  }

  /**
   * Build a sprint task specific message
   * @param {Object} ticket
   * @return {String} Sprint task specific attachment message
   */
  buildSprintTicket(ticket) {
    const {workflow, estimate, updated_at} = ticket;
    const [noop, year, month, day] = updated_at.match(/(\d{4})-(\d{2})-(\d{2})/);

    const message = [
      `_Workflow_: ${workflow}`,
      `_Updated_: ${month}/${day}/${year}`,
      `_Estimate_: ${estimate}`
    ];

    return message.join(' | ');
  }

  /**
   * Check if event is a valid message to respond to
   * @param {Object} event
   * @return {Boolean} Event is valid to respond to
   */
  isValidEvent(event) {
    return this.isChatMessage(event)
      && this.isValidConversation(event)
      && !this.isFromSelf(event)
      && this.isJabwireMention(event);
  }

  /**
   * Check if event is a valid chat message
   * @param {Object} event
   * @return {Boolean} If event is a valid message
   */
  isChatMessage(event) {
    return event.type === 'message' && !!event.text;
  }

  /**
   * Check if event is a valid conversation (either group or channel)
   * @param {Object} event
   * @return {Boolean} If event is a group or channel conversation
   */
  isValidConversation(event) {
    return typeof event.channel === 'string'
      && ['C', 'G'].indexOf(event.channel[0]) !== -1;
  }

  /**
   * Check if event is posted by the bot itself
   * @param {Object} event
   * @return {Boolean} If event is posted by itself
   */
  isFromSelf(event) {
    return event.user === this.user.id;
  }

  /**
   * Check if the event message is a Jabwire message
   * @param {Object} event
   * @return {Boolean} If event is probably a Jabwire message
   */
  isJabwireMention(event) {
    return event.text.toLowerCase().match(this.mention);
  }

  /**
   * Find user by name
   * @param {String} name
   * @return {Object}
   */
  findUserByName(name) {
    return this.users.filter((user) => {
      return user.name === name;
    })[0];
  }

  /**
   * Find medium (channel or group) by id
   * @param {String} id
   * @return {Object} Found medium
   */
  findMediumById(id) {
    const rooms = id[0] === 'G'
      ? this.groups
      : this.channels;

    return rooms.filter((room) => {
      return room.id === id;
    })[0];
  }

  /**
   * 
   * @param {String} project
   * @param {String} type
   * @param {String} id
   * @return {String}
   */
  buildUrl(project, type, id) {
    return this.jabwire
      .replace('{project}', project)
      .replace('{type}', type)
      .replace('{id}', id);    
  }

  /**
   * Format Jabwire type
   * @param {String} type
   * @return {String} 
   */
  formatTitle(type) {
    return this.types[type];
  }

}

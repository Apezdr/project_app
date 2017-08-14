(function() {

  //build a group object for looking up a group name from id
  var buildGroupList = function(item) {
    if(this.groups[item.id] === undefined){
      this.groups[item.id] = item.name;
      //build an array for the ticket submit pages to create dropdown list
      this.groupDrop.push({
        'label': '' + item.name + '',
        'value': '' + item.id + ''
      });
    }
    };
  //build a agent object for looking up a agent name from id
  var buildAgentList = function(item) {
    if(item.role !== 'end-user' && this.assignees[item.id] === undefined){
      this.assignees[item.id] = item.name;
      //build an array for the ticket submit pages to create dropdown list
      this.agentDrop.push({
        'label': '' + item.name + '',
        'value': '' + item.id + ''
      });
    }
    };
  //build a list of tickets in the project
  var buildTicketList = function(item) {
    var projectTag = item.external_id.replace(/-/i, '_').toLowerCase();
    var projectTagItem = item.tags.contains(projectTag);
    if(!projectTagItem){return;}
      //push a objects into a array for the ticket list page
      var type = (item.type == null ? '-' : item.type);
      var priority = (item.priority == null ? '-' : item.priority);
      var list = {
        'id': '' + item.id + '',
        'status': ''+item.status + '',
        'statusTitle': '' + this.I18n.t('status.'+item.status) + '',
        'priority': '' + priority + '',
        'type': '' + type + '',
        'assignee_id': '' + this.assigneeName(item.assignee_id) + '',
        'group_id': '' + this.groupName(item.group_id) + '',
        'subject': '' + item.subject
      };
      var hasProjectChildTag = _.include(item.tags, 'project_child');
      if (hasProjectChildTag) {
        if ((this.isSolvable === true) && !(_.include(this.whatIsSolved, item.status))) {
          this.isSolvable = false;
        }
        //if the ticket is a child ticket set the selected to false
        list.selected = !hasProjectChildTag;
      } else {
        // selected is true if the ticket is the parent
        list.selected = true;
      }
      this.ticketList.push(list);
    };
  var buildTicketFormList = function(item) {
    if(!item.active){ return; }
      this.ticketForms[item.id] = item.ticket_field_ids;
      this.ticketForms[item.id].name = item.name;
      if(this.ticket().form().id() === item.id ) {
        this.ticketForms[item.id].selected = true;
      }
      // get default ticket form ID as necessary
      if (item['default']) {
        this.defaultTicketFormID = item.id;
      }
    };
  var buildTicketFieldList = function(item) {
    // get default ticket form ID as necessary
    if (item.active && item.removable === true) {
      if(_.indexOf(this.ticketFieldList, item.id) === -1) {
        switch(item.type){
          case 'text':
            item.text = true;
            break;
          case 'textarea':
            item.textarea = true;
            break;
          case 'tagger':
            item.tagger = true;
            break;
          case 'basic_priority':
            item.pri = true;
            break;
          case 'priority':
            item.pri = true;
            break;
          case 'checkbox':
            item.checkbox = true;
            break;
          case 'date':
            item.date = true;
            break;
          case 'integer':
            item.integer = true;
            break;
          case 'decimal':
            item.decimal = true;
            break;
          case 'regexp':
            item.regexp = true;
            break;
          default:
            item.system = true;
        }
        this.ticketFieldList.push(item.id);
        this.ticketFieldObj.push(item);
      }
    }
    this.ticketForms['1'] = this.ticketFieldList;
    this.defaultTicketFormID = 1;
  };

  return {
    appID: 'ProjectApp',
    defaultState: 'noproject',
    prependSubject: '',
    appendSubject: '',
    groups: {},
    assignees: {},
    ticketForms: {},
    agentDrop: [],
    groupDrop: [],
    ticketList: [],
    createResultsData: [],
    isSolvable: true,
    whatIsSolved: ['closed', 'solved'],
    MAX_ATTEMPTS: 20,
    defaultTicketFormID: '',
    currentTicketformID: '',
    ticketFieldList: [],
    ticketFieldObj: [],
    currentTicket: {},
    assignable: [],
    notEnterprise: false,

    events: {
      // Lifecycle
      'app.activated': 'init',
      'ticket.form.id.changed': function() {
        this.currentTicketformID = this.ticket().form().id();
        _.defer(this.projectNameFieldExist.bind(this));
      },
      // DOM events
      'click .submitSpoke': 'createTicketValues',
      'click .makeproj': 'listProjects',
      'click .submitBulk': 'createBulkTickets',
      'click .displayForm': 'switchToRequester',
      'click .displayList': 'updateList',
      'click .displayMultiCreate': 'switchToBulk',
      'click .displayUpdate': 'switchToUpdate',
      'click .updateticket': 'updateTickets',
      'click .removeTicket': 'removeFrom',
      'change #zendeskForm': 'formSelected',
      'change #zenType': 'showDate',
      'blur #zendeskGroup': 'assignableAgents',

      // Requests
      'createTicket.done': 'processData',
      'createTicket.fail':'createChildFail',
      'getGroups.done': 'processGroups',
      'autocompleteAgent.done': 'processAgents',
      'getTicketForms.done': 'processTicketForms',
      'getTicketForms.fail': 'failTicketForms',
      'getExternalID.done': 'findProjects',
      'getTicketFields.done': 'processTicketFields',
      'searchExternalID.done': function(data) {
        this.listProjects(data || {});
      },

      // Zendesk Events
      'ticket.status.changed': 'ticketStatusChangedHandler'
    },
    //end events
    requests: {
      createTicket: function(childCall) {
        return {
          url: '/api/v2/tickets.json',
          dataType: 'JSON',
          type: 'POST',
          contentType: 'application/json',
          data: childCall,
          proxy_v2: true
        };
      },
      getGroups: function(page) {
        return {
          url: '/api/v2/groups/assignable.json?page=' + page,
          dataType: 'JSON',
          type: 'GET',
          proxy_v2: true
        };
      },
      putExternalID: function(data, id) {
        return {
          url: '/api/v2/tickets/' + id + '.json',
          dataType: 'JSON',
          type: 'PUT',
          contentType: 'application/json',
          data: data,
          proxy_v2: true
        };
      },
      getExternalID: function(ticket) {
        return {
          url: '/api/v2/tickets/' + ticket + '.json',
          dataType: 'JSON',
          type: 'GET',
          contentType: 'application/json',
          proxy_v2: true
        };
      },
      autocompleteUser: function(email) {
        return {
          url: '/api/v2/users/autocomplete.json?name=' + email,
          type: 'POST',
          proxy_v2: true
        };
      },
      autocompleteAgent: function(group,page) {
        return {
          url: '/api/v2/groups/'+group+'/memberships.json?include=users&page='+page,
          type: 'GET',
          proxy_v2: true
        };
      },
      searchExternalID: function(data, page) {
        return {
          url: '/api/v2/tickets.json?external_id=' + data + '&include=users,groups&page=' + page + '&per_page=50&lang='+this.currentUser().locale(),
          dataType: 'JSON',
          type: 'GET',
          contentType: 'application/json',
          proxy_v2: true
        };
      },

      getTicketForms: function() {
        return {
          url: '/api/v2/ticket_forms.json?lang='+this.currentUser().locale(),
          dataType: 'JSON',
          type: 'GET',
          proxy_v2: true
        };
      },
      getTicketFields: function() {
        return {
          url: '/api/v2/ticket_fields.json?lang='+this.currentUser().locale(),
          dataType: 'JSON',
          type: 'GET',
          proxy_v2: true
        };
      }
    },

    init: function() {
      this.getTicketFormData(1);
    },

    setGroups: function(arrGroups){
      arrGroups.forEach(function(x){
        this.$('#zendeskGSelect option[value="'+ x+'"]').attr('selected', 'selected');
      }, this);
    },
    setFields: function(arrFields){
      arrFields.forEach(function(x){
        this.$('#' + x.id).val(x.value);
      });
    },
    processData: function(data, response, responseText) {
      var locTicket = this.ticket();
      locTicket.tags().add(['project_parent', 'project_' + this.ticket().id()]);
      locTicket.customField('custom_field_' + this.settings.Custom_Field_ID + '', 'Project-' + this.ticket().id());
      if(data !== undefined) {
      this.createResultsData.push({
        'id': '' + data.ticket.id + '',
        'external_id': '' + data.ticket.external_id + ''
      });
      this.switchTo('description', {
        createResult: this.createResultsData
      });
      var currentTags = locTicket.tags();
      this.putTicketData(currentTags, 'project_parent', 'add', locTicket.id());
      }

    },
    createChildFail: function(data, response, responseText) {
      var msg = data.responseJSON.description + '<br>' + data.responseJSON.details.requester[0].description;
      services.notify(msg, 'error');
    },
    autocompleteRequesterEmail: function() {
      var self = this;
      // bypass this.form to bind the autocomplete.
      this.$('#userEmail').autocomplete({
        minLength: 3,
        source: function(request, response) {
          self.ajax('autocompleteUser', request.term).done(function(data) {
            response(_.map(data.users, function(user) {
              return {
                "label": user.name,
                "value": user.email
              };
            }));
          });
        },
        change: function(event, ui) {
          if (_.isNull(ui.item)) {
            self.$('#userName').parent().show();
            self.$('#userName').focus();
          }
        }
      }, this);
    },
    autocompleteAssignee: function() {
      var self = this;
      // bypass this.form to bind the autocomplete.
      this.$('#assigneeName').autocomplete({
        minLength: 3,
        source: this.assignable,
        select: function(event, ui) {
          self.$("#assigneeName").val(ui.item.label);
          self.$("#assigneeId").val(ui.item.value);
          return false;
        },
        change: function(event, ui) {
          if (_.isNull(ui.item)) {
            self.$("#assigneeName").val('');
            self.$("#assigneeId").val('');
          } else {
            self.$("#assigneeName").val(ui.item.label);
            self.$("#assigneeId").val(ui.item.value);
          }
        }
      }, this);
    },
    autocompleteGroup: function() {
      var self = this;
      // bypass this.form to bind the autocomplete.
      this.$('#zendeskGroup').autocomplete({
        minLength: 3,
        source: this.groupDrop,
        select: function(event, ui) {
          self.$("#zendeskGroup").val(ui.item.label);
          self.$("#zendeskGSelect").val(ui.item.value);
          return false;
        },
        change: function(event, ui) {
          if (_.isNull(ui.item)) {
            self.$("#zendeskGroup").val('');
            self.$("#zendeskGSelect").val('');
          } else {
            self.$("#zendeskGroup").val(ui.item.label);
            self.$("#zendeskGSelect").val(ui.item.value);
          }
        }
      }, this);
    },
    createTicketValues: function() {
      var fieldListArray = this.$('#custom-fields :input').serializeArray();
      var ticket = this.ticket();
      var groupSelected = [];
      this.createResultsData = [];
      if (Array.isArray(this.$('#zendeskGSelect').val())) {
        groupSelected = this.$('#zendeskGSelect').val();
      } else {
        groupSelected.push(this.$('#zendeskGSelect').val());
      }
      groupSelected.forEach(function(group) {
        var rootTicket = {};
        rootTicket.ticket = {};
        rootTicket.ticket.ticket_form_id = this.$('#zendeskForm').val();
        rootTicket.ticket.subject = this.$('#userSub').val();
        rootTicket.ticket.due_at = this.$('#dueDate').val();
        rootTicket.ticket.type = this.$('#zenType').val();
        rootTicket.ticket.priority = this.$('#zenPri').val();
        rootTicket.ticket.comment = {};
        rootTicket.ticket.comment.value = this.$('#ticketDesc').val();
        rootTicket.ticket.requester = {};
        if (this.$('#userName').val() !== '') {
          rootTicket.ticket.requester.name = this.$('#userName').val();
        }
        rootTicket.ticket.requester.email = this.$('#userEmail').val();
        if (!_.isEmpty(this.$('#assigneeId').val())) {
            rootTicket.ticket.assignee_id = this.$('#assigneeId').val();
        }
        rootTicket.ticket.group_id = group;
        rootTicket.ticket.external_id = 'Project-' + ticket.id();
        rootTicket.ticket.tags = ['project_child', 'project_' + ticket.id()];
        rootTicket.ticket.custom_fields = {};
        rootTicket.ticket.custom_fields[this.settings.Custom_Field_ID] = 'Project-' + ticket.id();
        fieldListArray.forEach(function(field){
          rootTicket.ticket.custom_fields[field.name] = field.value;
        }, this);
        this.duplicateCustomFieldsValues(rootTicket.ticket);
        var childCall = JSON.stringify(rootTicket);
        this.ajax('createTicket', childCall);
      }, this);
      //for the future
      //ticket.external_id('Project-' + ticket.id());

    },
    duplicateCustomFieldsValues: function(ticketObjectForApi) {
      var me = this;
      // Read out the ids for the desired custom fields to copy.
      var customFieldIdsToCopySetting = me.setting('customFieldIdsToCopy') || '',
          customFieldIdsToCopy = customFieldIdsToCopySetting.match(/\b\d+\b/g);
      // Done if there are none.
      if (!(customFieldIdsToCopy && customFieldIdsToCopy.length)) {
        return;
      }

      // Copy the value of each (existing) custom field. Don't overwrite.
      if (!_.has(ticketObjectForApi, 'custom_fields')) {
        ticketObjectForApi.custom_fields = {};
      }
      customFieldIdsToCopy.forEach(function(customFieldIdToCopy){
        if (_.has(ticketObjectForApi.custom_fields, customFieldIdToCopy)) {
          return;
        }
        ticketObjectForApi.custom_fields[customFieldIdToCopy] = me.ticket().customField('custom_field_' + customFieldIdToCopy + '');
      });
    },
    switchToRequester: function() {
      var newSubject = this.ticket().subject();
      var currentForm = this.ticket().form().id();
      var ticketType = this.getTicketTypes(this.setting('defaultTicketType') || this.ticket().type());
      //var ticketPri = this.setting('defaultTicketPriority' || this.ticket().priority());
      if (this.prependSubject) {
        newSubject = 'Project-' + this.ticket().id() + ' ' + newSubject;
      }
      if (this.appendSubject) {
        newSubject = newSubject + ' Project-' + this.ticket().id();
      }
      var assigneeId, assigneeName, groupId, groupName;
      if (this.setting('prefillAssignee')) {
        if (this.ticket().assignee().user()) {
          assigneeName = this.ticket().assignee().user().name();
          assigneeId = this.ticket().assignee().user().id();
        }
        if (this.ticket().assignee().group()) {
          groupName = this.ticket().assignee().group().name();
          groupId = this.ticket().assignee().group().id();
        }
      }
      this.switchTo('requester', {
        ticketForm: this.ticketForms,
        currentForm: currentForm,
        email: this.ticket().requester().email(),
        assigneeName: assigneeName,
        assigneeId: assigneeId,
        groupName: groupName,
        groupId: groupId,
        subject: newSubject,
        desc: this.ticket().description(),
        ticketType: ticketType
      });
      if(groupId){
        this.assignableAgents();
      }
      this.$('button.displayList').show();
      this.$('button.displayForm').hide();
      this.$('button.displayMultiCreate').show();
      this.autocompleteRequesterEmail();
      this.autocompleteGroup();
      if (this.notEnterprise) {
        this.$('#zendeskForm').val(1);
        this.$('#zendeskForm').parent().hide();
      }
      this.$('#zendeskForm').change();
      this.$('#dueDate').val(this.currentTicket.ticket.due_at).datepicker({ dateFormat: 'yy-mm-dd' });
      if(this.$('#zenType').val() === 'task'){
        this.$('#dueDate').parent().show();
      }
    },
    getProjectData: function() {
      //get all the groups
      this.getGroupsData(1);
      //get all the agents in the system V2 API
      // this.getAgentData(1);
      this.prependSubject = this.settings.prependSubject;
      this.appendSubject = this.settings.appendSubject;
      //get the exteranl API on the currently viewed ticket
      this.ajax('getExternalID', this.ticket().id());
      //get the value of the Project ticket field
      var projectField = this.settings.Custom_Field_ID;
      this.currentTicketformID = this.ticket().form().id() || this.defaultTicketFormID;
      this.projectNameFieldExist();
    },
    getTicketTypes: function(selectedType){
    var types = [{'title': '-', 'value': ''},{'title': ''+this.I18n.t('type.question')+'', 'value': 'question'},{'title': ''+this.I18n.t('type.incident')+'', 'value': 'incident'},{'title': ''+this.I18n.t('type.problem')+'', 'value': 'problem'},{'title': ''+this.I18n.t('type.task')+'', 'value': 'task'}];
    types.forEach(function(t){
      if(t.value === selectedType){
        t.selected = true;
      }
    });
    return types;
  },
    // check to see if the custom field for "project name" exist in current form or not
    projectNameFieldExist: function() {
      var thereAreNulls = [undefined, null, ''];
      if (_.indexOf(this.ticketForms[this.currentTicketformID], parseInt(this.settings.Custom_Field_ID, 10)) !== -1) {
        //check to see if the field is there, if it’s there is it empty.
        var isNotEmpty = (_.indexOf(thereAreNulls, this.ticket().customField('custom_field_' + this.settings.Custom_Field_ID + '')) === -1);
        if (isNotEmpty) {
          //if the field contains a value disable editing of the field
          this.ticketFields('custom_field_' + this.settings.Custom_Field_ID + '').disable();
        } else {
          //if it’s not returned or empty hide the field
          this.ticketFields('custom_field_' + this.settings.Custom_Field_ID + '').hide();
        }
      } else {
        // project name custom field ID does not show up in current ticket form
        return;
      }
    },

    findProjects: function(data) {
      this.currentTicket.ticket = data.ticket;
      var thereAreNulls = [undefined, null, ''];
      var isNotEmpty = (_.indexOf(thereAreNulls, data.ticket.external_id) === -1);
      if (isNotEmpty) {
        this.getProjectSearch(data.ticket.external_id, 1);
      }
    },
    getProjectSearch: function(externalID, page) {
      this.ajax('searchExternalID', externalID, page);
    },
    listProjects: function(data) {
      _.each(data.users, buildAgentList, this);
      _.each(data.groups, buildGroupList, this);
      this.ticketList = [];
      var nextPage = 1;
      var btnClicked = (data.type === 'click');
      if (!btnClicked) {
        this.isSolvable = true; // Resets solvable status before building Ticket List
        _.each(data.tickets, buildTicketList, this);
        if (data.next_page !== null) {
          nextPage = nextPage + 1;
          this.getProjectSearch(data.ticket[0].external_id, nextPage);
        }
      }
      this.switchTo('list', {
        projects: this.ticketList
      });
      this.parentSolve();
      //hide the remove button in the template if not child ticket
      this.$('button.child').hide();
      this.$('button.displayList').hide();
      this.$('button.parent').show();
      //if the current ticket is a child hide the create buttons in the template and show the remove
      if (_.indexOf(this.ticket().tags(), 'project_child') !== -1) {
        this.$('button.parent').hide();
        this.$('button.child').show();
      }
    },
    parentSolve: function() {
      //enable solve and if this.isSolvable is false disable solve
      this.ticketFields('status').options('solved').enable();
      //if this is a child ticket stop and exit function
      var hasProjectChildTag = _.include(this.ticket().tags(), 'project_child');
      if (hasProjectChildTag) {
        return true;
      }
      if (!this.isSolvable) {
        this.ticketFields('status').options('solved').disable();
      }
    },
    getGroupsData: function(page) {
      this.ajax('getGroups', page);
    },
    processGroups: function(data) {
      _.each(data.groups, buildGroupList, this);
      if (data.next_page !== null) {
        var nextPage = data.next_page.split('=');
        this.getGroupsData(nextPage[1]);
      }
    },
    processAgents: function(data) {
      this.$('#assigneeName').attr('class', "spinner dotted");
      this.assignable = _.map(data.users, function(user) {
        return {
          "label": user.name,
          "value": user.id
        };
      });
      if (data.next_page !== null) {
        var nextPage = data.next_page.split('&page=');
        this.ajax('autocompleteAgent',this.$("#zendeskGSelect").val(), nextPage[1]);
      } else {
        this.autocompleteAssignee();
        this.$('#assigneeName').attr('disabled', false).removeClass( "spinner dotted" );
      }
    },

    getTicketFormData: function(page) {
      this.ajax('getTicketForms', page);
    },

    processTicketForms: function(data) {
      var nextPage = 1;
      _.each(data.ticket_forms, buildTicketFormList, this);
      if (data.next_page !== null) {
        nextPage = nextPage + 1;
        this.getTicketFormData(nextPage);
      } else {
        this.getProjectData();
      }
    },
    failTicketForms: function(){
      this.notEnterprise = true;
      this.getTicketFieldsData(1);
      this.getProjectData();
    },
    processTicketFields: function(data){
      var nextPage = 1;
      _.each(data.ticket_fields, buildTicketFieldList, this);
      if (data.next_page !== null) {
        nextPage = nextPage + 1;
        this.getTicketFieldsData(nextPage);
      } else {
        this.displayFields = [];
        var selectedFormArray = this.ticketForms[this.$('#zendeskForm').val()];
        this.ticketFieldObj.forEach(function(d){
          if(_.contains(selectedFormArray, d.id)){
            if(d.type != "tickettype") {
              this.displayFields.push(d);
            }
          }
        }, this);
        this.fieldsHTML = this.renderTemplate('_fields', {
        fields: this.displayFields
      });
      this.$('#zendeskForm').closest('.control-group').after(this.fieldsHTML);
      this.processTicketFieldsData();
      }
    },
    //sets the value of the displayed ticket form in the app
    processTicketFieldsData: function(){
      //grab the custom field div find the input and make an array
      var fieldListArray = this.$('#custom-fields :input').serializeArray();
      //go through the array of current custom fields.
      fieldListArray.forEach(function(t){
        this.currentTicket.ticket.custom_fields.forEach(function(x){
          if(this.$('#' + x.id )){
            this.$('#' + x.id ).val(x.value);
          }
        }, this);
      }, this);
      var priSetting = this.setting('defaultTicketPriority') || this.ticket().priority();
      this.$('#zenPri').val(priSetting);
    },
    getTicketFieldsData: function(page){
      this.ajax('getTicketFields', page);
    },
    updateList: function() {
      this.ajax('getExternalID', this.ticket().id());
    },
    groupName: function(groupID) {
      if (groupID === null) {
        return 'None';
      }
      return this.groups[groupID] || 'None';
    },
    assigneeName: function(assigneeID) {
      if (assigneeID === null) {
        return 'None';
      }
      return this.assignees[assigneeID] || 'None';
    },
    formSelected: function(){
      this.$('#custom-fields').remove();
      this.fieldsHTML = '';
      this.getTicketFieldsData();
    },
    todaysDate: function() {
      var today = new Date();
      var dd = this.pad(today.getDate());
      var mm = this.pad(today.getMonth()+1); //January is 0!
      var yyyy = today.getFullYear();
      //return yyyy+'-'+mm+'-'+dd;
      return today;
    },
    pad: function(minutes) {
      var whole;
      if (Number(minutes) < 10) {
        whole = '0' + minutes;
      } else {
        whole = minutes;
      }
      return whole;
    },
    showDate: function(){
      if(this.$('#zenType').val() === 'task'){
        this.$('#dueDate').parent().show();
      }
    },
    switchToBulk: function() {
      var newSubject = this.ticket().subject();
      if (this.prependSubject) {
        newSubject = 'Project-' + this.ticket().id() + ' ' + newSubject;
      }
      if (this.appendSubject) {
        newSubject = newSubject + ' Project-' + this.ticket().id();
      }
      var ticketType = this.getTicketTypes(this.setting('defaultTicketType') || this.ticket().type());
      //var ticketPri = this.setting('defaultTicketPriority' || this.ticket().priority());
      var currentForm = this.ticket().form().id();
      var assigneeId, assigneeName;
      if (this.setting('prefillAssignee')) {
        if (this.ticket().assignee().user()) {
          assigneeName = this.ticket().assignee().user().name();
          assigneeId = this.ticket().assignee().user().id();
        }
      }
      this.switchTo('multicreate', {
        ticketForm: this.ticketForms,
        currentForm: currentForm,
        email: this.ticket().requester().email(),
        assigneeName: assigneeName,
        assigneeId: assigneeId,
        groups: this.groupDrop,
        subject: newSubject,
        desc: this.ticket().description(),
        ticketType: ticketType
      });
      this.$('button.displayList').show();
      this.$('button.displayForm').show();
      this.$('button.displayMultiCreate').hide();
      this.autocompleteRequesterEmail();
      if (this.notEnterprise) {
        this.$('#zendeskForm').val(1);
        this.$('#zendeskForm').parent().hide();
      }
      this.$('#zendeskForm').change();
      this.$('#dueDate').val(this.currentTicket.ticket.due_at).datepicker({ dateFormat: 'yy-mm-dd' });
      if(this.$('#zenType').val() === 'task'){
        this.$('#dueDate').parent().show();
      }
    },
    createBulkTickets: function() {
      this.createTicketValues();
    },
    switchToUpdate: function() {
      this.switchTo('updatetickets', {

      });
    },
    updateTickets: function() {
      var re = /,|\s/;
      var list = this.$('#listofIDs').val().split(re);
      //update the the current ticket
      var currentTags = this.ticket().tags();
      this.putTicketData(currentTags, 'project_parent', 'add', this.ticket().id());
      //get the list supplied and update the ticket.
      list.forEach(function(ticket) {
        this.ajax('getExternalID', ticket).done(function(data) {
          if ((data.ticket.status !== 'closed') && (_.indexOf(data.ticket.tags, 'project_child') === -1)) {
            this.putTicketData(data.ticket.tags, 'project_child', 'add', data);
          } else if (data.ticket.status === 'closed') {
            services.notify(data.ticket.id + ' is closed', 'error');
          } else if (_.indexOf(data.ticket.tags, 'project_child') !== -1) {
            services.notify('Ticket ' + data.ticket.id + ' is already a member of another project: ' + data.ticket.external_id + ' ', 'error');
          }
        });
      }, this);
    },
    removeFrom: function() {
      this.ajax('getExternalID', this.ticket().id()).done(function(data) {
        this.putTicketData(data.ticket.tags, 'project_child', 'remove', data);
        var projectTag = data.ticket.external_id.replace(/-/i, '_').toLowerCase();
        this.ticket().tags().remove(['project_child', projectTag]);
        this.ticket().customField('custom_field_' + this.settings.Custom_Field_ID + '', '');
      });
    },
    putTicketData: function(tags, linking, type, data) {
      var ticketTags = tags,
        isParent = (_.indexOf(ticketTags, 'project_parent') !== -1 || linking === 'project_parent'),
        ticketUpdateID, updateTicket = {};
      if (_.isObject(data)) {
        ticketUpdateID = data.ticket.id;
      } else {
        ticketUpdateID = data;
      }
      updateTicket.ticket = {};
      updateTicket.ticket.custom_fields = {};
      updateTicket.ticket.custom_fields[this.settings.Custom_Field_ID] = 'Project-' + this.ticket().id();
      updateTicket.ticket.external_id = 'Project-' + this.ticket().id();
      if (!isParent && type === 'add') {
        ticketTags.push(linking, 'project_' + this.ticket().id());
      } else if (!isParent && type === 'remove') {
        var projectTag = 'project_'+data.ticket.external_id;
        ticketTags.splice(_.indexOf(tags, "project_child"), 1);
        ticketTags.splice(_.indexOf(tags, projectTag), 1);
        updateTicket.ticket.custom_fields[this.settings.Custom_Field_ID] = '';
        updateTicket.ticket.external_id = '';
      } else {
        ticketTags.push(linking, 'project_' + this.ticket().id());
      }
      updateTicket.ticket.tags = ticketTags;
      var thisTicket = JSON.stringify(updateTicket);
      this.ajax('putExternalID', thisTicket, ticketUpdateID).done(function(data) {
        this.processData();
      });

    },
    // builds a list of agents for
    assignableAgents: function() {
      this.ajax('autocompleteAgent',this.$("#zendeskGSelect").val(), 1);
    },
    // Triggered whenever a ticket had a status change
    ticketStatusChangedHandler: function(){
      // Forces a list update to fetch new ticket status
      this.updateList();
    }
  };
}());

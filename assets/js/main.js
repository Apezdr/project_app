
client.invoke('resize', { width: '100%', height: '200px' });

var DATA = {
  objTicketFormResponse: {},
  objTicketFormData: {},
  objTicketForms: {},
  objGroupList: {},
  objTicketFieldList: {},
  arTicketList: [],
  strUserLocale: '',
  notEnterprise: false,
  isSolvable: true,
  prependSubject: '',
  appendSubject: '',
  defaultTicketFormID: '',
  currentTicketformID: '',
  intFormID: 0,
  intCurTicketID: 0,
  Custom_Field_ID: 0,
  prefillAssignee: '',
  objCurrentTicket: {},
  objAssignees: {},
  arAgentDrop: [],
  arGroupDrop: [],
  objGroups: {},
  arWhatIsSolved: ['closed', 'solved'],
  arAssignable: [],
  arCreateResultsData: []
};

var buildGroupList = function(objItem) {

  if ( _.isUndefined(DATA.objGroups[objItem.id]) ) {

    DATA.objGroups[objItem.id] = objItem.name;

    //build an array for the ticket submit pages to create dropdown list
    DATA.arGroupDrop.push({
      'label': objItem.name,
      'value': objItem.id
    });
  }
};

var buildTicketFormList = function(objItem) {

  if ( !objItem.active ) { return; }

    DATA.objTicketForms[objItem.id] = objItem.ticket_field_ids;
    DATA.objTicketForms[objItem.id].name = objItem.name;

    client.get('ticket').then(function(objTicket) {

      // store the form id
      DATA.intFormID = objTicket.ticket.form.id;
      DATA.intCurTicketID = objTicket.ticket.id;

      if (objTicket.ticket.form.id === objItem.id) {
        DATA.objTicketForms[objItem.id].selected = true;
      }

    });

    // get default ticket form ID as necessary
    if (objItem['default']) {
      DATA.defaultTicketFormID = objItem.id;
    }
};

 var buildAgentList = function(objItem) {

  if(objItem.role !== 'end-user' && _.isUndefined( DATA.objAssignees[objItem.id] )){

    DATA.objAssignees[objItem.id] = objItem.name;

    //build an array for the ticket submit pages to create dropdown list
    DATA.arAgentDrop.push({
      'label': objItem.name,
      'value': objItem.id
    });

  }
};

var buildTicketList = function(objItem) {

    var strProjectTag;

    if (! _.isNull(objItem.external_id) && objItem.external_id != "") {
      strProjectTag = objItem.external_id.replace(/-/i, '_').toLowerCase();
    }

    console.log('strProjectTag');
    console.log(strProjectTag);
    
    if ( ! _.contains(objItem.tags, strProjectTag) ) { return; }

      var strType = ( objItem.type == null ? '-' : objItem.type );
      var strPriority = ( objItem.priority == null ? '-' : objItem.priority );

      var objList = {
        'id': objItem.id,
        'status': objItem.status,
        'statusTitle': objItem.status, // this.I18n.t('status.'+objItem.status)
        'priority': strPriority,
        'type': strType,
        'assignee_id': assigneeName(objItem.assignee_id),
        'group_id': groupName(objItem.group_id),
        'subject': objItem.subject
      };

      var hasProjectChildTag = _.include(objItem.tags, 'project_child');

      if (hasProjectChildTag) {

        if ( (DATA.isSolvable === true) && ! ( _.include(DATA.arWhatIsSolved, objItem.status) ) ) {
          DATA.isSolvable = false;
        }

        //if the ticket is a child ticket set the selected to false
        objList.selected = !hasProjectChildTag;

      } else {
        // selected is true if the ticket is the parent
        objList.selected = true;
      }

      DATA.arTicketList.push(objList);
};

function getTicketFormData() {
  client.get('currentUser.locale').then(function(objCurUser) {
    DATA.strUserLocale = objCurUser['currentUser.locale'];
    this.getTicketForms(1);
  }.bind(this));
}

function getTicketForms(intPage) {

  var objRequest = {
    url:'/api/v2/ticket_forms.json?lang=' + DATA.strUserLocale + '&page=' + intPage,
    type:'GET',
    dataType: 'json'
  };

  client.request(objRequest).then(function(objData) {

    this.processTicketForms(objData);
    DATA.objTicketFormResponse = objData;

  }.bind(this), function(error) {

    DATA.notEnterprise = true;
    this.processTicketFields(1);
    this.getProjectData();
    console.error('Could not get ticket form data', error)

  });
}

function processTicketForms(objData) {

  var intNextPage = 1;

  _.each(objData.ticket_forms, buildTicketFormList, this);

  if (objData.next_page !== null) {

    intNextPage = intNextPage + 1;
    this.getTicketForms(intNextPage);

  } else {
    getProjectData();
  }
}

function getProjectData() {

  var strProjectField;

  getGroupsData(1);
  
  client.metadata().then(function(metadata) {

    DATA.appendSubject = metadata.settings.appendSubject;
    DATA.prependSubject = metadata.settings.prependSubject;
    DATA.currentTicketformID = DATA.currentTicketformID || DATA.defaultTicketFormID;
    DATA.prefillAssignee = metadata.settings.prefillAssignee;    

    client.get('ticket').then(function(objTicket) {
      // get the external id
      getExternalID(objTicket.ticket.id);
      projectNameFieldExist();
    });
  });
}

function projectNameFieldExist() {

  if ( _.indexOf(DATA.objTicketForms[DATA.currentTicketformID], parseInt(DATA.Custom_Field_ID, 10)) !== -1 ) {

  }
}


function getGroupsData(intPage) {

    var objRequest = {
      url:'/api/v2/groups/assignable.json?page=' + intPage,
      type:'GET',
      dataType: 'json'
    };

    client.request(objRequest).then(function(objData) {

      DATA.objGroupList = objData;

      if (objData.next_page !== null) {

        var intNextPage = objData.next_page.split('=');
        getGroupsData(intNextPage[1]);
      }

    }.bind(this), function(error) {
      console.error('Could not get ticket form data', error)
    })
}
    
function processTicketFields() {

    var objRequest = {
      url: '/api/v2/ticket_fields.json?lang=' + DATA.strUserLocale + '&page=' + intPage,
      type:'GET',
      dataType: 'json'
    };

    client.request(objRequest).then(function(objData) {

      var intNextPage = 1;
      DATA.objTicketFieldList = objData;

      if (objData.next_page !== null) {

        intNextPage = intNextPage + 1;
        this.processTicketFields(intNextPage);

      } else {

        var arDisplayFields = [];
        var arSelectedForm = app.ticketForms[$('#zendeskForm').val()];

        $.each(DATA.objTicketFieldList, function(objList) {

          if(_.contains(arSelectedForm, objList.id)){

              if(objList.type != "tickettype") {
                arDisplayFields.push(objList);
              }

            }
        });
      }

    }.bind(this), function(error) {
      console.error('Could not get ticket form data', error)
    })
  }

  function listProjects(objData) {

    var intNextPage = 1;
    var btnClicked = (objData.type === 'click');

    _.each(objData.users, buildAgentList, this);
    _.each(objData.groups, buildGroupList, this);

    DATA.arTicketList = [];

    if (!btnClicked) {
      // resets solvable status before building Ticket List
      DATA.isSolvable = true;

      // build ticket list
      _.each(objData.tickets, buildTicketList, this);

      if (objData.next_page !== null) {

        intNextPage = intNextPage + 1;
        getProjectSearch(objData.ticket[0].external_id, intNextPage);

      }
    }

    var objProjects = {
      projects: DATA.arTicketList
    }
    
    renderTemplate("project-lists", objProjects);
    parentSolve();

    $('button.child').hide();
    $('button.displayList').hide();
    $('button.parent').show();

    client.get('ticket.tags').then(function(objTicket) {
      if (_.indexOf(objTicket['ticket.tags'], 'project_child') !== -1) {
        $('button.parent').hide();
        $('button.child').show();
      }
    }.bind(this));

  }

  function parentSolve() {

    client.get('ticketFields:status').then(function(objTicket) {
      console.log('parent solve objTicket');
      console.log(objTicket['ticketFields:status'].options);
      // objTicket.ticketFields:status.options('solved').enable();
      client.get('ticket.tags').then(function(objTicket) {

        var hasProjectChildTag = _.include(objTicket['ticket.tags'], 'project_child');

        if (hasProjectChildTag) {
          return true;
        }
        if ( ! DATA.isSolvable ) {
          // DATA.ticketFields('status').options('solved').disable();
        }
      }.bind(this));
    }.bind(this));
  }
    
  function renderTemplate(element, objData) {
    // render
    var source = $("#" + element).html();
    var template = Handlebars.compile(source);
    var html = template(objData);
    $("#content").html(html);
  }

  function switchToRequester () {

    var strAssigneeID, strAssigneeName, strGroupName, strGroupID;
    
    var arTicketType = getTicketTypes(); 

    client.get('ticket').then(function(objTicket) {

      console.log('objTicket');
      console.log(objTicket);
      
      var strNewSubject = objTicket.ticket.subject;

      if (DATA.prependSubject) {
        strNewSubject = 'Project-' + intTicketID + ' ' + strNewSubject;
      }

      if (DATA.appendSubject) {
        strNewSubject = strNewSubject + ' Project-' + intTicketID;
      }

      if (DATA.prefillAssignee) {
        if (! _.isUndefined(objTicket.ticket.assignee.user)) {
          strAssigneeName = objTicket.ticket.assignee.user.name;
          strAssigneeID = objTicket.ticket.assignee.user.id;
        }

        if (! _.isUndefined(objTicket.ticket.assignee.group)) {
          strGroupName = objTicket.ticket.assignee.group.name;
          strGroupID = objTicket.ticket.assignee.group.id;
        }
      }
      
      var objData = {
        ticketForm: DATA.objTicketFormResponse.ticket_forms,
        currentForm: objTicket.ticket.form.id,
        email: objTicket.ticket.requester.email,
        assigneeName: strAssigneeName,
        assigneeId: strAssigneeID,
        groupName: strGroupName,
        groupId: strGroupID,
        subject: strNewSubject,
        desc: objTicket.ticket.description,
        ticketType: getTicketTypes()
      };

      console.log('objData here!!');
      console.log(objData);

      this.renderTemplate("create-single-ticket", objData);

      if (strGroupID) {
        assignableAgents();
      }

    }.bind(this));
  }

  function getTicketTypes (strSelectedType){

    var arTypes = 
    [ 
      {'title': '-', 'value': ''}, 
      {'title': 'Question', 'value': 'question'}, 
      {'title': 'Incident', 'value': 'incident'}, 
      {'title': 'Problem', 'value': 'problem'}, 
      {'title': 'Task', 'value': 'task'}
    ];
    
    $.each(arTypes, function(objType) {

      if (objType.value === strSelectedType) {
        objType.selected = true;
      }
    });

    return arTypes;
  }

  function getExternalID(intTicketID) {
     
      var objRequest = {
        url: '/api/v2/tickets/' + intTicketID + '.json',
        type:'GET',
        dataType: 'json'
      };

      client.request(objRequest).then(function(objData) {

        DATA.objCurrentTicket.ticket = objData.ticket;

        if (! _.isUndefined(objData.ticket.external_id) || ! _.isNull(objData.ticket.external_id)) {
          getProjectSearch(objData.ticket.external_id, 1);
        }

      }.bind(this), function(error) {
        console.error('Could not get ticket form data', error)
      });
  }

  function getProjectSearch (intExternalID, intPage) {

    var objRequest = {
        url: '/api/v2/tickets.json?external_id=' + intExternalID + '&include=users,groups&page=' + intPage + '&per_page=50&lang=' + DATA.strUserLocale,
        type:'GET',
        dataType: 'json'
    };

    client.request(objRequest).then(function(objData) {
      listProjects(objData);
    }.bind(this), function(error) {
      console.error('Could not get ticket form data', error)
    });

  }

  function assigneeName (intAssigneeID) {

    if (intAssigneeID === null) {
      return 'None';
    }

    return DATA.objAssignees[intAssigneeID] || 'None';
  }

  function groupName (intGroupID) {

    if (intGroupID === null) {
      return 'None';
    }

    return DATA.objGroups[intGroupID] || 'None';
  }

  function assignableAgents(strGroupName, intPage) {

    var objRequest = {
        url: '/api/v2/groups/' + strGroupName + '/memberships.json?include=users&page=' + intPage,
        type:'GET',
        dataType: 'json'
    };

    client.request(objRequest).then(function(objData) {

      $('#assigneeName').attr('class', "spinner dotted");

      DATA.assignable = _.map(objData.users, function(objUser) {
        return {
          "label": objUser.name,
          "value": objUser.id
        };
      });

      if (objData.next_page !== null) {

        var arNextPage = objData.next_page.split('&page=');
        assignableAgents($("#zendeskGSelect").val(), arNextPage[1]);

      } else {

        autocompleteAssignee();
        $('#assigneeName').attr('disabled', false).removeClass( "spinner dotted" );
      }

    }.bind(this), function(error) {
      console.error('Could not get ticket form data', error)
    });
    
  }

  function autocompleteAssignee() {
    // bypass this.form to bind the autocomplete.
    $('#assigneeName').autocomplete({
      minLength: 3,
      source: this.assignable,
      select: function(event, ui) {
        $("#assigneeName").val(ui.item.label);
        $("#assigneeId").val(ui.item.value);
        return false;
      },
      change: function(event, ui) {
        if (_.isNull(ui.item)) {
          $("#assigneeName").val('');
          $("#assigneeId").val('');
        } else {
          $("#assigneeName").val(ui.item.label);
          $("#assigneeId").val(ui.item.value);
        }
      }
    }, this);
  }

  function createTicketValues() {
    var arFieldList = $('#custom-fields :input').serializeArray();
    var arGroupSelected = [];
    DATA.arCreateResultsData = [];

    if (Array.isArray($('#zendeskGSelect').val())) {
      arGroupSelected = $('#zendeskGSelect').val();
    } else {
      arGroupSelected.push($('#zendeskGSelect').val());
    }

    client.get('ticket.id').then(function(objTicket) {

      var intTicketID = objTicket['ticket.id'];

       $.each(arGroupSelected, function(intGroupID) {
          console.log('group id');
          console.log(intGroupID);
          var objRootTicket = {};
          objRootTicket.ticket = {};
          objRootTicket.ticket.ticket_form_id = $('#zendeskForm').val();
          objRootTicket.ticket.subject = $('#userSub').val();
          objRootTicket.ticket.due_at = $('#dueDate').val();
          objRootTicket.ticket.type = $('#zenType').val();
          objRootTicket.ticket.priority = $('#zenPri').val();
          objRootTicket.ticket.comment = {};
          objRootTicket.ticket.comment.value = $('#ticketDesc').val();
          objRootTicket.ticket.requester = {};

          if ($('#userName').val() !== '') {
            objRootTicket.ticket.requester.name = $('#userName').val();
          }

          objRootTicket.ticket.requester.email = $('#userEmail').val();

          if (!_.isEmpty($('#assigneeId').val())) {
              objRootTicket.ticket.assignee_id = $('#assigneeId').val();
          }

          objRootTicket.ticket.group_id = intGroupID;
          objRootTicket.ticket.external_id = 'Project-' + intTicketID;
          objRootTicket.ticket.tags = ['project_child', 'project_' + intTicketID];
          objRootTicket.ticket.custom_fields = {};

          client.metadata().then(function(metadata) {
            objRootTicket.ticket.custom_fields[metadata.settings.Custom_Field_ID] = 'Project-' + intTicketID;
          });
         
          $.each(arFieldList, function(objField) {
            objRootTicket.ticket.custom_fields[objField.name] = objField.value;
          });

          duplicateCustomFieldsValues(objRootTicket.ticket);

          var objTicketData = JSON.stringify(objRootTicket);
          createTicket(objTicketData);
       });

    });

  }

  function createTicket(objTicketData) {
    var objRequest = {
      url:'/api/v2/tickets.json',
      type:'POST',
      dataType: 'json',
      data: objTicketData
    };

    console.log('objTicketData');
    console.log(objTicketData);

    client.request(objRequest).then(function(objData) {
      console.log('objData here...');
      console.log(objData);
      processData(objData);

    }.bind(this), function(error) {
      console.error('Could not get ticket form data', error)
    });
  }

  function duplicateCustomFieldsValues(ticketObjectForApi) {

    client.metadata().then(function(metadata) {
      var customFieldIdsToCopySetting = metadata.settings.customFieldIdsToCopy || '';
      var customFieldIdsToCopy = customFieldIdsToCopySetting.match(/\b\d+\b/g);

      // Done if there are none.
      if (!(customFieldIdsToCopy && customFieldIdsToCopy.length)) {
        return;
      }

      // Copy the value of each (existing) custom field. Don't overwrite.
      if (!_.has(ticketObjectForApi, 'custom_fields')) {
        ticketObjectForApi.custom_fields = {};
      }

      $.each(customFieldIdsToCopy, function(customFieldIdToCopy) {

        if (_.has(ticketObjectForApi.custom_fields, customFieldIdToCopy)) {
          return;
        }

        client.get('ticket.customField:custom_field_' + customFieldIdToCopy).then(function(objTicket) {
          ticketObjectForApi.custom_fields[customFieldIdToCopy] = objTicket['ticket.customField:custom_field_' + customFieldIdToCopy];
        });

      });
    });
      
  }

  function processData(objData) {
      client.get('ticket').then(function() {

        var intTicketID = objTicket.ticket.id;

        client.invoke('ticket.tags.add', ['project_parent', 'project_' + intTicketID]);

        client.metadata().then(function(metadata) {
          client.set('ticket.customField:' + metadata.settings.Custom_Field_ID, 'Project-' + intTicketID);

          if(! _.isUndefined(objData)) {

            DATA.arCreateResultsData.push({
              'id': objData.ticket.id,
              'external_id': objData.ticket.external_id
            });

            renderTemplate("description", {
               createResult: arCreateResultsData
            });

            var arCurrentTags = objTicket['ticket.tags'];

            putTicketData(arCurrentTags, 'project_parent', 'add', objTicket);
          }

        });

      });
  }

  function putTicketData (arTags, strLinking, strType, objData) {
      var arTicketTags = arTags;

      var isParent = (_.indexOf(arTicketTags, 'project_parent') !== -1 || strLinking === 'project_parent');

      var intTicketUpdateID, objUpdateTicket = {};

      if (_.isObject(objData)) {
        intTicketUpdateID = objData.ticket.id;
      } else {
        intTicketUpdateID = objData;
      }
      client.metadata().then(function(metadata) {

        objUpdateTicket.ticket = {};
        objUpdateTicket.ticket.custom_fields = {};
        objUpdateTicket.ticket.custom_fields[metadata.settings.Custom_Field_ID] = 'Project-' + objData.ticket.id;
        objUpdateTicket.ticket.external_id = 'Project-' + objData.ticket.id;

        if (!isParent && strType === 'add') {

          arTicketTags.push(strLinking, 'project_' + objData.ticket.id);

        } else if (!isParent && strType === 'remove') {

          var projectTag = 'project_' + objData.ticket.external_id;
          arTicketTags.splice(_.indexOf(arTags, "project_child"), 1);
          arTicketTags.splice(_.indexOf(arTags, projectTag), 1);
          objUpdateTicket.ticket.custom_fields[metadata.settings.Custom_Field_ID] = '';
          objUpdateTicket.ticket.external_id = '';

        } else {
          arTicketTags.push(strLinking, 'project_' + this.ticket().id());
        }

        objUpdateTicket.ticket.arTags = arTicketTags;
        var objTicketData = JSON.stringify(objUpdateTicket);

        putExternalID(objTicketData, intTicketUpdateID);
       
      });
  }

  function putExternalID(objTicketData, objTicketUpdateID) {
     // this.ajax('putExternalID', thisTicket, objTicketUpdateID).done(function(objData) {
     //      this.processData();
     //    });

     var objRequest = {
        url: '/api/v2/tickets/' + objTicketUpdateID + '.json',
        type:'POST',
        dataType: 'json',
        data: objTicketData
    };

    client.request(objRequest).then(function(objData) {

        processData(objData);

    }.bind(this), function(error) {
      console.error('Could not get ticket form data', error)
    });
  }


  // document ready
  $(document).ready(function() {

    getTicketFormData();

    $('#listProjects').on('click', function() {
      listProjects();
    });

    $(document).on('click', '.displayForm', function() {
      switchToRequester();
    });

    $(document).on('click', '.submitSpoke', function() {
      createTicketValues();
    });

  });





resizeApp(200);

// add template path
$.handlebars({
    templatePath: './templates',
    templateExtension: 'hbs'
});

Handlebars.registerHelper('ifCond', function(v1, v2, options) {
  if(v1 === v2) {
    return options.fn(this);
  }
  return options.inverse(this);
});

// render default template
$('#app').render('noproject',{});

// global variable
var DATA = {
  objTicketFormResponse: {},
  objTicketFormData: {},
  objTicketForms: {},
  objGroupList: {},
  arTicketFieldList: [],
  arTicketField: [],
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
  arAssignees: {},
  arAgentDrop: [],
  arGroupDrop: [],
  objGroups: {},
  arWhatIsSolved: ['closed', 'solved'],
  arAssignable: [],
  arCreateResultsData: [],
  isPublic: true,
  strTicketDescription: '',
  strNewTicketDescription: '',
  intTicketID: 0,
  objCustomFieldMapping: {}
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

  if(objItem.role !== 'end-user' && _.isUndefined( DATA.arAssignees[objItem.id] )){

    DATA.arAssignees[objItem.id] = objItem.name;

    //build an array for the ticket submit pages to create dropdown list
    DATA.arAgentDrop.push({
      'label': objItem.name,
      'value': objItem.id
    });

  }
};

var buildTicketFieldList = function(objItem) {
    // get default ticket form ID as necessary
    if (objItem.active && objItem.removable === true) {
      if(_.indexOf(DATA.arTicketFieldList, objItem.id) === -1) {
        switch(objItem.type){
          case 'text':
            objItem.text = true;
            break;
          case 'textarea':
            objItem.textarea = true;
            break;
          case 'tagger':
            objItem.tagger = true;
            break;
          case 'basic_priority':
            objItem.pri = true;
            break;
          case 'priority':
            objItem.pri = true;
            break;
          case 'checkbox':
            objItem.checkbox = true;
            break;
          case 'date':
            objItem.date = true;
            break;
          case 'integer':
            objItem.integer = true;
            break;
          case 'decimal':
            objItem.decimal = true;
            break;
          case 'regexp':
            objItem.regexp = true;
            break;
          default:
            objItem.system = true;
        }
        DATA.arTicketFieldList.push(objItem.id);
        DATA.arTicketField.push(objItem);
      }
    }
    DATA.objTicketForms['1'] = DATA.arTicketFieldList;
    DATA.defaultTicketFormID = 1;
  };

var buildTicketList = function(objItem) {

    var strProjectTag;
   
    strProjectTag = objItem.external_id.replace(/-/i, '_').toLowerCase();
    
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
    getTicketForms(1);
  }.bind(this));

}

function getTicketForms(intPage) {

  var objRequest = {
    url:'/api/v2/ticket_forms.json?lang=' + DATA.strUserLocale + '&page=' + intPage,
    type:'GET',
    dataType: 'json'
  };

  client.request(objRequest).then(function(objData) {

    processTicketForms(objData);
    // DATA.objTicketFormResponse = objData;

  }.bind(this), function(error) {

    DATA.notEnterprise = true;
    processTicketFields(1);
    getProjectData();
    console.error('Could not get ticket form data', error)

  });
}

function processTicketForms(objData) {

  var intNextPage = 1;

  _.each(objData.ticket_forms, buildTicketFormList, this);

  if (objData.next_page !== null) {

    intNextPage = intNextPage + 1;
    getTicketForms(intNextPage);

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
    DATA.Custom_Field_ID = metadata.settings.Custom_Field_ID;

    client.get('ticket').then(function(objTicket) {
      // get the external id
      getExternalID(objTicket.ticket.id);
      DATA.currentTicketformID = objTicket.ticket.form.id || DATA.defaultTicketFormID;
      projectNameFieldExist();
    });
  });
}

function projectNameFieldExist() {

  var thereAreNulls = [undefined, null, ''];

  if ( _.indexOf(DATA.objTicketForms[DATA.currentTicketformID], parseInt(DATA.Custom_Field_ID, 10)) !== -1 ) {

    client.get('ticket.customField:custom_field_' + DATA.Custom_Field_ID).then(function(objTicket) {
      
      var isNotEmpty = (_.indexOf(thereAreNulls, objTicket['ticket.customField:custom_field_' + DATA.Custom_Field_ID]) === -1);

      client.metadata().then(function(metadata) {
        if (isNotEmpty) {
          //if the field contains a value disable editing of the field
          client.invoke('ticketFields:custom_field_' + metadata.settings.Custom_Field_ID + '.disable');
        } else {
          //if it’s not returned or empty hide the field
          client.invoke('ticketFields:custom_field_' + metadata.settings.Custom_Field_ID + '.hide');
        }
      });
      
    }.bind(this));
  } else {
    return;
  }
}


function getGroupsData(intPage) {

    var objRequest = {
      url:'/api/v2/groups/assignable.json?page=' + intPage,
      type:'GET',
      dataType: 'json'
    };

    client.request(objRequest).then(function(objData) {

      _.each(objData.groups, buildGroupList, this);

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
      url: '/api/v2/ticket_fields.json?lang=' + DATA.strUserLocale,
      type:'GET',
      dataType: 'json'
    };

    client.request(objRequest).then(function(objData) {

      var intNextPage = 1;

      _.each(objData.ticket_fields, buildTicketFieldList, this);

      if (objData.next_page !== null) {

        intNextPage = intNextPage + 1;
        getTicketFieldsData(intNextPage);

      } else {

        var arDisplayFields = [];
        var arSelectedForm = DATA.objTicketForms[$('#zendeskForm').val()];

        DATA.arTicketField.forEach(function(objList) {
          if(_.contains(arSelectedForm, objList.id)){

              if(objList.type != "tickettype") {
                arDisplayFields.push(objList);
              }

            }
        });


        DATA.fieldsHTML = $('#custom-fields-row').render('_fields', {
          fields: arDisplayFields
        });

        $('#zendeskForm').closest('.control-group').after(DATA.fieldsHTML);
        processTicketFieldsData();
      }

    }.bind(this), function(error) {
      console.error('Could not get ticket form data', error)
    })
  }

  function processTicketFieldsData (){

    //grab the custom field div find the input and make an array
    var fieldListArray = $('#custom-fields :input').serializeArray();
    //go through the array of current custom fields.
    fieldListArray.forEach(function(t){
      DATA.objCurrentTicket.ticket.custom_fields.forEach(function(x){
        if($('#' + x.id )){
          $('#' + x.id ).val(x.value);
        }
      }, this);
    }, this);

    client.get('ticket').then(function(objTicket) {
      client.metadata().then(function(metadata) {
        var priSetting = metadata.settings.defaultTicketPriority || objTicket.ticket.priority;
        $('#zenPri').val(priSetting);
      });
    }.bind(this)); 
  }

  function listProjects(objData) {
    var intNextPage = 1;
    DATA.arTicketList = [];

    _.each(objData.users, buildAgentList, this);
    _.each(objData.groups, buildGroupList, this);

    var btnClicked = (objData.type === 'click');

    if (!btnClicked) {
      // resets solvable status before building Ticket List
      DATA.isSolvable = true;

      // build ticket list
      _.each(objData.tickets, buildTicketList, this);

      // if (objData.next_page !== null) {
      //   console.log('objData next_page');
      //   console.log(objData);
      //   intNextPage = intNextPage + 1;

      //   getProjectSearch(objData.tickets[0].external_id, intNextPage);
      // }
    }

    var objProjects = {
      projects: DATA.arTicketList
    }

    $('#app').render('project-list', objProjects);

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
      // enable solved
      client.invoke('ticketFields:status.options:solved.enable');

      client.get('ticket.tags').then(function(objTicket) {

        var hasProjectChildTag = _.include(objTicket['ticket.tags'], 'project_child');

        if (hasProjectChildTag) {
          return true;
        }
        if ( ! DATA.isSolvable ) {
          client.invoke('ticketFields:status.options:solved.disable');
        }
      }.bind(this));
    }.bind(this));
  }
    

  function switchToRequester () {
    // resizeApp();
    client.invoke('resize', { width: '100%', height: '350px' });
    var strAssigneeID, strAssigneeName, strGroupName, strGroupID;
    
    var arTicketType = getTicketTypes(); 

    client.get('ticket').then(function(objTicket) {
      
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
        ticketForm: DATA.objTicketForms,
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


      $('#app').render('requester', objData);

      if (strGroupID) {
        assignableAgents($("#zendeskGSelect").val(), 1);
      }

      $('button.displayList').show();
      $('button.displayForm').hide();
      $('button.displayMultiCreate').show();
 
      if (DATA.notEnterprise) {
        $('#zendeskForm').val(1);
        $('#zendeskForm').parent().hide();
      }

      $('#zendeskForm').val($('#zendeskForm').find(":selected").val()).trigger('change');
      $('#zendeskForm').val($('#zendeskForm').find(":selected").val()).trigger('change');
      $('#zendeskForm').val($('#zendeskForm').find(":selected").val()).trigger('change');
      $('#dueDate').val(DATA.objCurrentTicket.ticket.due_at).datepicker({ dateFormat: 'yy-mm-dd' });
      if($('#zenType').val() === 'task'){
        $('#dueDate').parent().show();
      }

    });
  }

  function autocompleteRequesterEmail() {
    var self = this;
    // bypass this.form to bind the autocomplete.
    $('#userEmail').autocomplete({
      minLength: 3,
      source: function(request, response) {
         var objRequest = {
            url: '/api/v2/users/autocomplete.json?name=' + request.term,
            type:'GET',
            dataType: 'json'
          };

          client.request(objRequest).then(function(objData) {
            response(_.map(objData.users, function(user) {
              return {
                "label": user.name,
                "value": user.email
              };
            }));

          }.bind(this), function(error) {
            console.error('Could not get ticket form data', error)
          });

      },
      change: function(event, ui) {
        if (_.isNull(ui.item)) {
          $('#userName').parent().show();
          $('#userName').focus();
        }
      }
    });
  }

  function autocompleteGroup() {
    $('#zendeskGroup').autocomplete({
      minLength: 3,
      source: DATA.arGroupDrop,
      select: function(event, ui) {
        $("#zendeskGroup").val(ui.item.label);
        $("#zendeskGSelect").val(ui.item.value);
        return false;
      },
      change: function(event, ui) {
        if (_.isNull(ui.item)) {
          $("#zendeskGroup").val('');
          $("#zendeskGSelect").val('');
        } else {
          $("#zendeskGroup").val(ui.item.label);
          $("#zendeskGSelect").val(ui.item.value);
        }
      }
    });
  }

  function autocompleteAssignee() {

    // bypass this.form to bind the autocomplete.
    $('#assigneeName').autocomplete({
      minLength: 3,
      source: DATA.arAssignable,
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
    });
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

    arTypes.forEach(function(objType) {
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
        var thereAreNulls = [undefined, null, ''];
        var isNotEmpty = (_.indexOf(thereAreNulls, objData.ticket.external_id) === -1);

        if (isNotEmpty) {
          getProjectSearch(objData.ticket.external_id, 1);
        }

      }.bind(this), function(error) {
        console.error('Could not get ticket form data', error)
      });
  }

  function getProjectSearch (intExternalID, intPage) {

    var objRequest = {
        url: '/api/v2/tickets.json?external_id=' + intExternalID + '&include=users,groups&lang=' + DATA.strUserLocale,
        type:'GET',
        dataType: 'json'
    };

    client.request(objRequest).then(function(objData) {
      listProjects(objData || {});
    }.bind(this), function(error) {
      console.error('Could not get ticket form data', error)
    });

  }

  function assigneeName (intAssigneeID) {

    if (intAssigneeID === null) {
      return 'None';
    }

    return DATA.arAssignees[intAssigneeID] || 'None';
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

      DATA.arAssignable = _.map(objData.users, function(objUser) {
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

  function createTicketValues() {

    var arFieldList = $('#custom-fields :input').serializeArray();
    var arGroupSelected = [];
    DATA.arCreateResultsData = [];

    if (Array.isArray($('#zendeskGSelect').val())) {
      arGroupSelected = $('#zendeskGSelect').val();
    } else {
      arGroupSelected.push($('#zendeskGSelect').val());
    }

    client.get('ticket').then(function(objTicket) {
  
      var intTicketID = objTicket.ticket.id;
  
      proceedCreateTicketValues(arGroupSelected, intTicketID, arFieldList);
      
      var arCurrentTags = objTicket.ticket.tags;

      putTicketData(arCurrentTags, 'project_parent', 'add', intTicketID);
      addTicketTags(['project_parent', 'project_' + intTicketID], intTicketID);

    });

  }

  function proceedCreateTicketValues(arGroupSelected, intTicketID, arFieldList) {

    if (! _.isEmpty(arGroupSelected)) {

      arGroupSelected.forEach(function(intGroupID) {
          
          var objRootTicket = {};
          objRootTicket.ticket = {};
          objRootTicket.ticket.ticket_form_id = $('#zendeskForm').val();
          objRootTicket.ticket.subject = $('#userSub').val();

          if (! _.isUndefined($('due_date').val())) {
            objRootTicket.ticket.due_at = formatDate($('#dueDate').val());
          }
          
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
          
          arFieldList.forEach(function(objField) {
            objRootTicket.ticket.custom_fields[objField.name] = objField.value;
          }); 
           var obj = {}
          $.each(DATA.objCustomFieldMapping, function(key, value) {
            // need to change the value?
            if (value != "=") { 
              objRootTicket.ticket.custom_fields[key] = value;
            }
            
          });

          duplicateCustomFieldsValues(objRootTicket.ticket);

          var isCopyDescription = $('#copyDescription').is(':checked');

          if (! isCopyDescription) {
            objRootTicket.ticket.comment.public = false;
          }
        
          createTicket(objRootTicket);
      });
    } else {
       client.invoke('notify', 'Please select a group', 'error');
    }
    
  }

  function createTicket(objTicketData) {
    var objRequest = {
      url:'/api/v2/tickets.json',
      type:'POST',
      dataType: 'json',
      data: objTicketData
    };

    client.request(objRequest).then(function(objData) {
      processData(objData, "add");
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
      customFieldIdsToCopy.forEach(function(customFieldIdToCopy) {

        if (_.has(ticketObjectForApi.custom_fields, customFieldIdToCopy)) {
          return;
        }

        client.get('ticket.customField:custom_field_' + customFieldIdToCopy).then(function(objTicket) {
          ticketObjectForApi.custom_fields[customFieldIdToCopy] = objTicket['ticket.customField:custom_field_' + customFieldIdToCopy];
        });

      });
    });
      
  }

  function processData(objData, strType) {

      client.get('ticket').then(function(objTicket) {

        var intTicketID = objTicket.ticket.id;

        // client.invoke('ticket.tags.add', ['project_parent', 'project_' + intTicketID]);
        // addTicketTags(['project_parent', 'project_' + intTicketID], intTicketID);

        client.metadata().then(function(metadata) {
          client.set('ticket.customField:custom_field_' + metadata.settings.Custom_Field_ID, 'Project-' + intTicketID);

        });

        if(! _.isUndefined(objData)) {

          // do not display the same ticket id
          if (strType == "add" && objData.ticket.id !== intTicketID) {
            DATA.arCreateResultsData.push({
              'id': objData.ticket.id,
              'external_id': objData.ticket.external_id,
              'type': strType
            });
          } else if (strType == "remove") {
            DATA.arCreateResultsData.push({
              'id': objData.ticket.id,
              'external_id': objData.ticket.external_id,
              'type': strType,
              'parent_id': intTicketID
            });
          }

          $('#app').render('description',{createResult: DATA.arCreateResultsData});

          if (strType == "remove") {
            $('button.child').hide();
            $('button.displayList').hide();
            $('button.parent').show();
          }

          // resizeApp();
          client.invoke('resize', { width: '100%', height: 'auto' });

        }

      });
  }

  function addTicketTags(arTags, intTicketID) {
   
    var objRequest = {
      url:'/api/v2/tickets/' + intTicketID + '/tags.json',
      type:'PUT',
      dataType: 'json',
      data: {
        tags: arTags
      }
    };


    client.request(objRequest).then(function(objData) {
     console.log('success adding tags');
     console.log(objData);
    }.bind(this), function(error) {
      console.error('Could not get ticket form data', error)
    });
  }

  function removeTicketTags(arTags, intTicketID) {
    var objRequest = {
      url:'/api/v2/tickets/' + intTicketID + '/tags.json',
      type:'DELETE',
      dataType: 'json',
      data: {
        tags: arTags
      }
    };

    client.request(objRequest).then(function(objData) {
     console.log('success removing tags');
     console.log(objData);
    }.bind(this), function(error) {
      console.error('Could not get ticket form data', error)
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

      client.get('ticket').then(function(objTicket) {
        client.metadata().then(function(metadata) {

          objUpdateTicket.ticket = {};
          objUpdateTicket.ticket.custom_fields = {};
          objUpdateTicket.ticket.custom_fields[metadata.settings.Custom_Field_ID] = 'Project-' + objTicket.ticket.id;
          objUpdateTicket.ticket.external_id = 'Project-' + objTicket.ticket.id;

          if (!isParent && strType === 'add') {

            arTicketTags.push(strLinking, 'project_' + objTicket.ticket.id);

          } else if (!isParent && strType === 'remove') {

            var strProjectTag = 'project_' + objData.ticket.external_id;

            arTicketTags.splice(_.indexOf(arTags, "project_child"), 1);
            
            arTicketTags.splice(_.indexOf(arTags, strProjectTag), 1);

            objUpdateTicket.ticket.custom_fields[metadata.settings.Custom_Field_ID] = '';
            objUpdateTicket.ticket.external_id = '';

          } else {
            arTicketTags.push(strLinking, 'project_' + objTicket.ticket.id);
          }

          objUpdateTicket.ticket.tags = arTicketTags;

          putExternalID(objUpdateTicket, intTicketUpdateID, strType);
         
        });
      });
  }

  function putExternalID(objTicketData, intTicketUpdateID, strType) {

     var objRequest = {
        url: '/api/v2/tickets/' + intTicketUpdateID + '.json',
        type:'PUT',
        dataType: 'json',
        data: objTicketData
    };

    client.request(objRequest).then(function(objData) {
        processData(objData, strType);
    }.bind(this), function(error) {
      console.error('Could not get ticket form data', error)
    });
  }

  function updateList() {
    // resizeApp();
    client.invoke('resize', { width: '100%', height: '250px' });
    client.get('ticket').then(function(objTicket) {
      getExternalID(objTicket.ticket.id);
    });
    
  }

  function switchToBulk() {
    // resizeApp();
    client.invoke('resize', { width: '100%', height: '350px' });

    client.get('ticket').then(function(objTicket) {
        
      var strNewSubject = objTicket.ticket.subject;
      var intTicketID = objTicket.ticket.id;
      DATA.strTicketDescription = objTicket.ticket.description;
      DATA.intTicketID = intTicketID;


      if (DATA.prependSubject) {
        strNewSubject = 'Project-' + intTicketID + ' ' + strNewSubject;
      }

      if (DATA.appendSubject) {
        strNewSubject = strNewSubject + ' Project-' + intTicketID;
      }

      client.metadata().then(function(metadata) {
        var intAssigneeID, strAssigneeName;
        var strTicketType = getTicketTypes(metadata.settings.defaultTicketType) || objTicket.ticket.type;
        var intCurrentFormID = objTicket.ticket.form.id;

        if (metadata.settings.prefillAssignee) {

          if (objTicket.ticket.assignee.user) {
            strAssigneeName = objTicket.ticket.assignee.user.name;
            intAssigneeID = objTicket.ticket.assignee.user.id;
          }

        }

        $('#app').render('multicreate',{
          ticketForm: DATA.objTicketForms,
          currentForm: intCurrentFormID,
          email: objTicket.ticket.requester.email,
          assigneeName: strAssigneeName,
          assigneeId: intAssigneeID,
          groups: DATA.arGroupDrop,
          subject: strNewSubject,
          desc: objTicket.ticket.description,
          ticketType: strTicketType,
          intTicketID: intTicketID
        });

        $('button.displayList').show();
        $('button.displayForm').show();
        $('button.displayMultiCreate').hide();
        autocompleteRequesterEmail();
        if (DATA.notEnterprise) {
          $('#zendeskForm').val(1);
          $('#zendeskForm').parent().hide();
        }
        $('#zendeskForm').val($('#zendeskForm').find(":selected").val()).change();
        $('#dueDate').val(DATA.objCurrentTicket.ticket.due_at).datepicker({ dateFormat: 'yy-mm-dd' });
        if($('#zenType').val() === 'task'){
          $('#dueDate').parent().show();
        }

      });

    });
  }

  function switchToUpdate() {
    $('#app').render('updatetickets',{});
    resizeApp(220);
  }

  function createBulkTickets() {
    createTicketValues();
  }

  function updateTickets() {
     
    var arList = $('#listofIDs').val().split(/,|\s/);

    client.get('ticket').then(function(objTicket) {
       //update the the current ticket
      var arCurrentTags = objTicket.ticket.tags;

      
      putTicketData(arCurrentTags, 'project_parent', 'add', objTicket.ticket.id);
      
      //get the list supplied and update the ticket.
      arList.forEach(function(intTicketID) {
         var objRequest = {
          url:'/api/v2/tickets/' + intTicketID + '.json',
          type:'GET',
          dataType: 'json',
        };

        client.request(objRequest).then(function(objData) {

          DATA.objCurrentTicket.ticket = objData.ticket;
          var thereAreNulls = [undefined, null, ''];
          var isNotEmpty = (_.indexOf(thereAreNulls, objData.ticket.external_id) === -1);

          if (isNotEmpty) {
            getProjectSearch(objData.ticket.external_id, 1);
          }

          if ((objData.ticket.status !== 'closed') && (_.indexOf(objData.ticket.tags, 'project_child') === -1)) {
              putTicketData(objData.ticket.tags, "project_child", 'add', objData);  
          } else if (objData.ticket.status === 'closed') {
            client.invoke('notify', objData.ticket.id + ' is closed', 'error');
          } else if (_.indexOf(objData.ticket.tags, 'project_child') !== -1) {
            client.invoke('notify', 'Ticket ' + objData.ticket.id + ' is already a member of another project: ' + objData.ticket.external_id + ' ', 'error');
          }

        }.bind(this), function(error) {
          console.error('Could not get ticket form data', error)
        });
      });

     
    });
  }

  function formSelected() {
    $('#custom-fields').remove();
    DATA.fieldsHTML = '';
    getTicketFieldsData();
  }

  function getTicketFieldsData (page){
    processTicketFields(page);
  }

  function removeFromProject() {
   
    client.get('ticket').then(function(objTicket) {
      var intTicketID = objTicket.ticket.id;

      var objRequest = {
        url: '/api/v2/tickets/' + intTicketID + '.json',
        type:'GET',
        dataType: 'json'
      };

      client.request(objRequest).then(function(objData) {
        DATA.objCurrentTicket.ticket = objData.ticket;

        var thereAreNulls = [undefined, null, ''];

        var isNotEmpty = (_.indexOf(thereAreNulls, objData.ticket.external_id) === -1);

        if (isNotEmpty) {
          getProjectSearch(objData.ticket.external_id, 1);
        }

        putTicketData(objData.ticket.tags, 'project_child', 'remove', objData);

        var projectTag = objData.ticket.external_id.replace(/-/i, '_').toLowerCase();

        removeTicketTags(['project_child', projectTag], intTicketID);
       
        client.metadata().then(function(metadata) {
          client.set('ticket.customField:custom_field_' + metadata.settings.Custom_Field_ID, '');
        });
       
      }.bind(this), function(error) {
        console.error('Could not get ticket form data', error)
      });
    });
  }

  function validateMapping() {

    client.metadata().then(function(metadata) {
      var objCustomFieldMapping = metadata.settings.custom_field_mapping;

      if (! _.isUndefined(objCustomFieldMapping)) {
        
        if (validateJSON(objCustomFieldMapping)) {

          DATA.objCustomFieldMapping = JSON.parse(objCustomFieldMapping);
         
        } else {
          client.invoke('notify', 'Custom Field Mapping is not a valid JSON', 'error');
        }
      }
      

    });
  }

  function validateJSON(objJSON) {
    try {
      JSON.parse(objJSON);
    } catch(ex) {
      return false;
    }

    return true;
  }

  function resizeApp(newHeight) {
    var height;

    if (newHeight) {
      height = newHeight + 'px';
    } else {
      height = $(document).height();
    }

    console.log(height);

    client.invoke('resize', { width: '100%', height: height });
  }

  function showDate() {
    if($('#zenType').val() === 'task'){
      $('#dueDate').parent().show();
    } else {
      $('#dueDate').parent().hide();
    }
  }

  function formatDate(date) {
    var d = new Date(date),
        month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear();

    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;

    return [year, month, day].join('-');
  }

  // EVENTS

  $(document).on('click', '.makeproj', function(objData) {
    listProjects(objData);
  });

  
  $(document).on('click', '.submitSpoke', function() {
    createTicketValues();
  });

  $(document).on('click', '.displayList', function() {
    updateList();
  });

  $(document).on('click', '.displayMultiCreate', function() {
    switchToBulk();
  });

  $(document).on('click', '.displayUpdate', function() {
    switchToUpdate();
  });

  $(document).on('click', '.submitBulk', function() {
    createBulkTickets();
  });

  $(document).on('click', '.updateticket', function() {
    updateTickets();
  });

  $(document).on('change', '#zendeskForm', function() {
    console.log('zendesk form on change');
    formSelected();
  });

  $(document).on('click', '.removeTicket', function() {
    removeFromProject();
  });

  $(document).on('click', '.open-ticket-tab', function() {
    // get ticket id
    var intTicketID = $(this).data('id');
    // open new ticket tab
    client.invoke('routeTo', 'ticket', intTicketID);
  });

  $(document).on('keyup', '#zendeskGroup', function() {
    autocompleteGroup();
  });

  $(document).on('keyup', '#userEmail', function() {
    autocompleteRequesterEmail();
  });

  $(document).on('keyup', '#assigneeName', function() {
    autocompleteAssignee();
  });

  $(document).on('click', '.displayForm', function() {
    switchToRequester();
  });

  $(document).on('blur', '#zendeskGroup', function() {
    assignableAgents($("#zendeskGSelect").val(), 1);
  });

  $(document).on('change', '#zenType', function() {
    showDate();
    $( "#dueDate" ).datepicker();
    $( "#dueDate" ).datepicker( "option", "dateFormat", 'MM d, yy' );
  });


  $(document).on('change', '#copyDescription', function() {
    if ( $(this).is(':checked')) {
      $('#ticketDesc').val(DATA.strTicketDescription);
    } else {
      $('#ticketDesc').val("Child of Ticket #" + DATA.intTicketID);
    }
  });

  $(document).tooltip({
    tooltipClass: "tooltip-styling"
  });


  validateMapping();

  getTicketFormData();










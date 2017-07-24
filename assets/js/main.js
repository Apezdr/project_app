
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
  arWhatIsSolved: ['closed', 'solved']
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

//build a list of tickets in the project
var buildTicketList = function(objItem) {

    var strProjectTag = objItem.external_id.replace(/-/i, '_').toLowerCase();

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

        if ( (DATA.isSolvable === true) && ! ( _.include(DAA.arWhatIsSolved, objItem.status) ) ) {
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
    });
   
    projectNameFieldExist();
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

  }

  function parentSolve() {

    client.get('ticketFields:status').then(function(objTicket) {
      console.log('parent solve objTicket');
      console.log(objTicket);
      // objTicket.ticketFields:status.options('solved').enable();
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

      this.renderTemplate("create-single-ticket", objData);

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

  function getProjectSearch(intExternalID, intPage) {

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


  // document ready
  $(document).ready(function() {

    getTicketFormData();

    $('#listProjects').on('click', function() {
      listProjects();
    });

    $(document).on('click', '.displayForm', function() {
      switchToRequester();
    });

  });






client.invoke('resize', { width: '100%', height: '200px' });

var DATA = {
  objTicketFormResponse: {},
  objTicketFormData: {},
  objTicketForms: {},
  objGroupList: {},
  objTicketFieldList: {},
  objTicketList: [],
  strUserLocale: '',
  notEnterprise: false,
  isSolvable: true,
  prependSubject: '',
  appendSubject: ''
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
      console.log(DATA.objTicketFormResponse);

    }.bind(this), function(error) {
      DATA.notEnterprise = true;
      this.processTicketFields(1);
      this.getProjectData();
      console.error('Could not get ticket form data', error)
    });
}

function processTicketForms(objData) {

  var intNextPage = 1;

  if (objData.next_page !== null) {

    intNextPage = intNextPage + 1;
    this.getTicketForms(intNextPage);

  } else {
    // this.getProjectData();
  }
}


function getGroupsData() {
    var objRequest = {
      url:'/api/v2/groups/assignable.json?page=' + intPage,
      type:'GET',
      dataType: 'json'
    };

    client.request(objRequest).then(function(objData) {

      DATA.objGroupList = objData;

      if (data.next_page !== null) {

        var intNextPage = objData.next_page.split('=');
        this.getGroupsData(intNextPage[1]);
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

    DATA.objTicketList = {
      projects: {}
    };
    
    // no projects
    renderTemplate("project-lists", DATA.objTicketList);
    $('button.child').hide();
    $('button.displayList').hide();
    $('button.parent').show();
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

      if (! _.isUndefined(objTicket.ticket.assignee.user)) {
        strAssigneeName = objTicket.ticket.assignee.user.name;
        strAssigneeID = objTicket.ticket.assignee.user.id;
      }

      if (! _.isUndefined(objTicket.ticket.assignee.group)) {
        strGroupName = objTicket.ticket.assignee.group.name;
        strGroupID = objTicket.ticket.assignee.group.id;
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
    var arTypes = [{'title': '-', 'value': ''},{'title': 'Question', 'value': 'question'},{'title': 'Incident', 'value': 'incident'},{'title': 'Problem', 'value': 'problem'},{'title': 'Task', 'value': 'task'}];
    
    $.each(arTypes, function(objType) {

      if (objType.value === strSelectedType) {
        objType.selected = true;
      }
    });

    return arTypes;
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





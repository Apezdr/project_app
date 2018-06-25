// global variable
var DATA = {
  objTicketFormResponse: {},
  objTicketFormData: {},
  objTicketForms: {},
  objGroupList: {},
  arTicketFieldList: [],
  arTicketField: [],
  arTicketList: [],
  ticketFieldcomp: {},
  currentUser: {},
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
  next_page: 0,
  prev_page: 0,
  isPrevPage: true,
  isNextPage: true,
  isProceed: true,
  context: [],
  defaultLocale: 'en-US',
  objTicket: {},
  default_ticket_type: '',
  default_ticket_priority: '',
  stay_on_save: false
};
var buildTicketFieldList = function (objItem) {
  // get default ticket form ID as necessary
  if (objItem.active && objItem.removable === true) {
    if (_.indexOf(DATA.arTicketFieldList, objItem.id) === -1) {
      switch (objItem.type) {
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
        case 'tickettype':
          objItem.tickettype = true;
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
  DATA.objTicketForms[1] = DATA.arTicketField;
  //DATA.defaultTicketFormID = 1;
};

// pull the metadata for the settings
client.metadata().then(function (metadata) {
  DATA.appendSubject = metadata.settings.appendSubject || false;
  DATA.prependSubject = metadata.settings.prependSubject || false;
  DATA.currentTicketformID = DATA.currentTicketformID || DATA.defaultTicketFormID;
  DATA.prefillAssignee = metadata.settings.prefillAssignee || false;
  DATA.Custom_Field_ID = metadata.settings.Custom_Field_ID;
  DATA.default_ticket_type = metadata.settings.defaultTicketType;
  DATA.default_ticket_priority = metadata.settings.defaultTicketPriority;
});

function firstData() {
  Promise.all([client.get('currentUser'),
    client.get('ticket'),
    client.get('ticket.assignee.user'),
    client.get('ticket.assignee.group'),
    client.get('ticketFields'),
    client.get('currentAccount.planName'),
    client.get('ticket.postSaveAction')
  ]).then(
    function fullfilled(contents) {
      DATA.currentUser = contents[0]['currentUser'];
      DATA.objTicket = contents[1].ticket;
      DATA.objTicket.assignee = contents[2]['ticket.assignee.user'];
      DATA.objTicket.group = contents[3]['ticket.assignee.group'];
      processCurrentTicketFields(contents[4]);
      this.getTicketFormData();
      this.stayOnSave(contents[6]);
      this.tryRequire(DATA.currentUser.locale);
    }
  ).catch(function (err) {
    console.log('error', err)
  });
};

client.on('app.registered', function (appData) {
  // In order to render the translated strings the Agents locale
  firstData();
});

client.on('app.activated', function (appData) {
  // In order to render the translated strings the Agents locale
  firstData();
});

function updateList() {
  this.getExternalID();
};
// adding translation handler for handlebars
Handlebars.registerHelper('t', function (key) {
  try {
    return DATA.context['' + key + ''];
  } catch (e) {
    console.error(e);
    return e.message;
  }
});
// take the agents locale and call the realated translation object
function tryRequire(locale) {
  try {
    $.getJSON('./translations/' + locale + '.json').done(function (data) {
      DATA.context = flatten(data);
      // render default template
      $('#nav').render('nav', {});

    }).fail(function (x) {
      //if the agents language is not available use the default
      tryRequire(DATA.defaultLocale);
    });
  } catch (e) {
    console.log(e);
    return null;
  }
};

//flatten a JSON of JSON objects to a single object
function flatten(object) {
  var flattened = {};
  Object.keys(object).forEach(function (key) {
    if (object[key] && typeof object[key] === 'object') {
      var flatObject = flatten(object[key]);
      Object.keys(flatObject).forEach(function (key2) {
        flattened[[key, key2].join('.')] = flatObject[key2];
      });
    } else {
      flattened[key] = object[key];
    }
  });
  return flattened;
};

//adding conditional operator for handlebars
Handlebars.registerHelper('ifCond', function (v1, v2, options) {
  if (v1 === v2) {
    return options.fn(this);
  }
  return options.inverse(this);
});

// add template path
$.handlebars({
  templatePath: './templates',
  templateExtension: 'hbs'
});


var buildGroupList = function (objItem) {
  if (_.isUndefined(DATA.objGroups[objItem.id])) {

    DATA.objGroups[objItem.id] = objItem.name;

    //build an array for the ticket submit pages to create dropdown list
    DATA.arGroupDrop.push({
      'label': objItem.name,
      'value': objItem.id
    });
  }
};

var buildTicketFormList = function (objItem) {
  if (!objItem.active) {
    return;
  }
  DATA.objTicketForms[objItem.id] = objItem.ticket_field_ids;
  DATA.objTicketForms[objItem.id].name = objItem.name;
  DATA.objTicketForms[objItem.id].id = objItem.id;

  // store the form id
  DATA.intFormID = DATA.objTicket.form.id;
  DATA.intCurTicketID = DATA.objTicket.id;

  // get default ticket form ID as necessary
  if (objItem['default']) {
    DATA.defaultTicketFormID = objItem.id;
  }
};


// process the ticket fields for the render functions
var processTicketFields = function (next) {
  //need to fix the loop to get all fields
  var strAssigneeID, strAssigneeName, strGroupName, strGroupID;
  var arDisplayFields = [];
  var strNewSubject = DATA.objTicket.subject;
  var intTicketID = DATA.objTicket.id;
  var objRequest = {
    url: '/api/v2/ticket_fields.json?lang=' + DATA.currentUser.locale + '&page=' + next,
    type: 'GET',
    dataType: 'json'
  };
  if (DATA.prefillAssignee) {
    strAssigneeID = DATA.objTicket.assignee.id;
    strAssigneeName = DATA.objTicket.assignee.name;
    strGroupName = DATA.objTicket.group.name;
    strGroupID = DATA.objTicket.group.id;
  }
  if (DATA.prependSubject) {
    strNewSubject = 'Project-' + intTicketID + ' ' + strNewSubject;
  }

  if (DATA.appendSubject) {
    strNewSubject = strNewSubject + ' Project-' + intTicketID;
  }
  $.each(DATA.objTicketForms, function (i, obj) {
    delete obj.selected;
  });

  var arSelectedForm = DATA.objTicketForms[DATA.currentTicketformID];
  DATA.objTicketForms[DATA.currentTicketformID].selected = true;
  client.request(objRequest).then(function (objData) {
    //not sure if needed
    //var intNextPage = next;
    _.each(objData.ticket_fields, buildTicketFieldList, this);
    DATA.arTicketField.forEach(function (objList) {
      if (DATA.notEnterprise && objList.type === 'tickettype') {
        arDisplayFields.push(objList);
      }
      if (DATA.notEnterprise && objList.type === 'priority') {
        arDisplayFields.push(objList);
      }
      if (_.contains(arSelectedForm, objList.id)) {
        arDisplayFields.push(objList);
      }
    });

    $.each(arDisplayFields, function (index, objDisplayFields) {
      DATA.objCurrentTicket.custom_fields.forEach(function (objData) {
        if (objDisplayFields.id == objData.id) {
          if (objDisplayFields.type == "tagger") {
            for (var i = 0; i < arDisplayFields[index]['custom_field_options'].length; i++) {
              arDisplayFields[index]['custom_field_options'][i]['set_value'] = objData.value;
            }

          } else {
            arDisplayFields[index]['set_value'] = objData.value;
          }
        }
      });
      if (objDisplayFields.type == "tickettype") {
        for (var i = 0; i < arDisplayFields[index]['system_field_options'].length; i++) {
          arDisplayFields[index]['system_field_options'][i]['set_value'] = DATA.default_ticket_type || DATA.objTicket.type;
        }
      }

      if (objDisplayFields.type == "priority") {
        for (var i = 0; i < arDisplayFields[index]['system_field_options'].length; i++) {
          arDisplayFields[index]['system_field_options'][i]['set_value'] = DATA.default_ticket_priority || DATA.objTicket.priority;
        }
      }
    });
    if ($('#assigneeName').length === 1) {
      switchToRequester();
    } else if ($('#zendeskGroup').length === 1) {
      switchToBulk();
    }
  });
  // end of processing ticket fields

  DATA.ticketFieldcomp = {
    ticketForm: DATA.objTicketForms,
    currentForm: DATA.currentTicketformID,
    email: DATA.objTicket.requester.email,
    assigneeName: strAssigneeName,
    assigneeId: strAssigneeID,
    groupName: strGroupName,
    groups: DATA.arGroupDrop,
    groupId: strGroupID,
    subject: strNewSubject,
    desc: DATA.objTicket.description,
    intTicketID: intTicketID,
    fields: arDisplayFields
  };

};

function sortObject(a, b) {
  var id1 = a.id;
  var id2 = b.id;
  let comparison = 0;
  if (id1 < id2) {
    comparison = 1
  } else if (id1 > id2) {
    comparison = -1;
  }
  return comparison;
}
//build the list of tickets linked by external_id populate data for tooltip
var buildTicketList = function (objItem) {
  var strProjectTag;
  strProjectTag = objItem.external_id.replace(/-/i, '_').toLowerCase();

  if (!_.contains(objItem.tags, strProjectTag)) {
    return;
  }
  var strType = (objItem.type == null ? '-' : objItem.type);
  var strPriority = (objItem.priority == null ? '-' : objItem.priority);
  var objList = {
    'id': objItem.id,
    'status': objItem.status,
    'statusTitle': objItem.status, // this.I18n.t('status.'+objItem.status)
    'priority': strPriority,
    'type': strType,
    'assignee_id': DATA.arAssignees[objItem.assignee_id] || 'None',
    'group_id': groupName(objItem.group_id),
    'subject': objItem.subject
  };
  var hasProjectChildTag = _.include(objItem.tags, 'project_child');

  if (hasProjectChildTag) {

    if ((DATA.isSolvable === true) && !(_.include(DATA.arWhatIsSolved, objItem.status))) {
      DATA.isSolvable = false;
    }

    //if the ticket is a child ticket set the selected to false
    objList.selected = !hasProjectChildTag;

  } else {
    // selected is true if the ticket is the parent
    objList.selected = true;
  }
  DATA.arTicketList.push(objList);
  // the sort is required because the assignee lookups return async messing up the search order 
  DATA.arTicketList.sort(sortObject)
  var objProjects = {
    projects: DATA.arTicketList,
    isNextPage: DATA.isNextPage,
    isPrevPage: DATA.isPrevPage
  }
  var d1 = $.Deferred();
  $('#app').render('project-list', objProjects);
  d1.resolve('');

  app.addEventListener('DOMNodeInserted', function () {
    resizeApp();
  })

};

function getTicketFormData() {
  var objRequest = {
    url: '/api/v2/account/settings.json',
    type: 'GET',
    dataType: 'json'
  };
  client.request(objRequest).then(function (objData) {
    if (objData.settings.active_features.ticket_forms) {
      getTicketForms(1);
    } else {
      DATA.notEnterprise = true;
      //processTicketFields(1);
      DATA.objTicket.form.id = 1;
      DATA.objTicketForms[1] = [];
      DATA.objTicketForms[1].name = 'Default';
      DATA.objTicketForms[1].id = 1;
      getProjectData();
    }
  });
};

function getTicketForms(intPage) {

  var objRequest = {
    url: '/api/v2/ticket_forms.json?lang=' + DATA.currentUser.locale + '&page=' + intPage,
    type: 'GET',
    dataType: 'json'
  };

  client.request(objRequest).then(function (objData) {
    processTicketForms(objData);
    // DATA.objTicketFormResponse = objData;

  }.bind(this), function (error) {

    DATA.notEnterprise = true;
    //processTicketFields(1);
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
  getGroupsData(1);
  // get the external id
  getExternalID();
  DATA.currentTicketformID = DATA.objTicket.form.id;
  projectNameFieldExist();
}

function projectNameFieldExist() {
  var thereAreNulls = [undefined, null, ''];
  //if(DATA.notEnterprise){return;}
  if (_.indexOf(DATA.objTicketForms[DATA.currentTicketformID], parseInt(DATA.Custom_Field_ID, 10)) !== -1) {

    client.get('ticket.customField:custom_field_' + DATA.Custom_Field_ID).then(function (objTicket) {

      var isNotEmpty = (_.indexOf(thereAreNulls, objTicket['ticket.customField:custom_field_' + DATA.Custom_Field_ID]) === -1);

      client.metadata().then(function (metadata) {
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
    url: '/api/v2/groups/assignable.json?page=' + intPage,
    type: 'GET',
    dataType: 'json'
  };

  client.request(objRequest).then(function (objData) {

    _.each(objData.groups, buildGroupList, this);

    if (objData.next_page !== null) {

      var intNextPage = objData.next_page.split('=');
      getGroupsData(intNextPage[1]);
    }

  }.bind(this), function (error) {
    console.error('Could not get ticket form data', error)
  })
}

function listProjects(objData) {
  DATA.arTicketList = [];

  var btnClicked = (objData.type === 'click');

  if (!btnClicked) {
    // resets solvable status before building Ticket List
    DATA.isSolvable = true;
    // list of assignees
    _.each(objData.tickets, assigneeName, this);
    if (objData.next_page !== null) {
      DATA.next_page = getUrlParameter("page", objData.next_page);
      DATA.external_id = objData.tickets[0].external_id;
      DATA.isNextPage = true;

    } else {
      DATA.isNextPage = false;
    }

    if (objData.previous_page !== null) {

      DATA.prev_page = getUrlParameter("page", objData.previous_page);
      DATA.external_id = objData.tickets[0].external_id;
      DATA.isPrevPage = true;

    } else {
      DATA.isPrevPage = false;
    }

  }
  // // build ticket list
  // _.each(objData.results, buildTicketList, this);

  var objProjects = {
    projects: DATA.arTicketList,
    isNextPage: DATA.isNextPage,
    isPrevPage: DATA.isPrevPage
  }
  var d1 = $.Deferred();
  $('#app').render('project-list', objProjects);
  d1.resolve('');

  app.addEventListener('DOMNodeInserted', function () {
    resizeApp();
  })

  parentSolve();

  if (_.indexOf(DATA.objTicket.tags, 'project_child') !== -1) {
    $('button.parent').hide();
    $('button.child').show();
  } else {
    $('button.child').hide();
    $('button.displayList').hide();
    $('button.parent').show();
  }

}

function parentSolve() {

  client.get('ticketFields:status').then(function (objTicket) {
    // enable solved
    client.invoke('ticketFields:status.options:solved.enable');

    var hasProjectChildTag = _.include(DATA.objTicket.tags, 'project_child');

    if (hasProjectChildTag) {
      return true;
    }
    if (!DATA.isSolvable) {
      client.invoke('ticketFields:status.options:solved.disable');
    }

  }.bind(this));
}

function showDate() {
  if ($('#zenType').val() === 'task') {
    $('#dueDate').parent().show();
    client.get('ticket.customField:due_date').then(function (dateData) {
      var currDate = formatDate(dateData['ticket.customField:due_date']);
      $('#dueDate').val(currDate).datepicker({
        dateFormat: 'yy-mm-dd'
      });
    });
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
  var offset = DATA.currentUser.timeZone.formattedOffset.split('GMT')
  return [year, month, day].join('-') + 'T00:00:01' + offset[1];
}

function switchToRequester() {
  $('#app').render('requester', DATA.ticketFieldcomp);
  var fieldRow = document.getElementById('app');
  var observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      $('#custom-fields-row').render('_fields', DATA.ticketFieldcomp);
    });
  });
  var config = {
    attributes: true,
    childList: true,
    characterData: true
  };
  observer.observe(fieldRow, config);

  $('button.displayList').show();
  $('button.displayForm').hide();
  $('button.displayMultiCreate').show();

  resizeApp();
  // BIG BUG DATA.objCurrentTicket.due_at doesn't exsist 
  // $('#dueDate').val(DATA.objCurrentTicket.due_at).datepicker({ dateFormat: 'yy-mm-dd' });
  $('#custom-fields-row').render('_fields', DATA.ticketFieldcomp);
  showDate();
  $(document).ready(function () {
    if (DATA.notEnterprise) {
      $('#zendeskForm').val(1);
      $('#zendeskForm').parent().hide();
    }
  })
}

function autocompleteRequesterEmail() {
  // bypass this.form to bind the autocomplete.
  $('#userEmail').autocomplete({
    minLength: 3,
    source: function (request, response) {
      var objRequest = {
        url: '/api/v2/users/autocomplete.json?name=' + request.term,
        type: 'GET',
        dataType: 'json'
      };

      client.request(objRequest).then(function (objData) {
        response(_.map(objData.users, function (user) {
          return {
            "label": user.name,
            "value": user.email
          };
        }));

      }.bind(this), function (error) {
        console.error('Could not get ticket form data', error)
      });

    },
    change: function (event, ui) {
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
    select: function (event, ui) {
      $("#zendeskGroup").val(ui.item.label);
      $("#zendeskGSelect").val(ui.item.value);
      return false;
    },
    change: function (event, ui) {
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
    select: function (event, ui) {
      $("#assigneeName").val(ui.item.label);
      $("#assigneeId").val(ui.item.value);
      return false;
    },
    change: function (event, ui) {
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

function processCurrentTicketFields(data) {
  DATA.objCurrentTicket.custom_fields = [];
  data.ticketFields.forEach(function (x) {
    if (x.type !== 'built-in') {
      client.get('ticketFields:' + x.name).then(function (d) {
        for (var i in d) {
          if (d.hasOwnProperty(i)) {
            if (i !== 'errors') {
              if ((d[i].type !== 'priority') && (d[i].type !== 'tickettype')) {
                d[i].id = parseInt(d[i].name.match(/(?!custom_field_)(\d+)/)[0], 10);
                DATA.objCurrentTicket.custom_fields.push(d[i]);
                if (DATA.notEnterprise) {
                  DATA.objTicketForms[1].push(d[i].id);
                }
              } else {
                d[i].id = d[i].name;
                DATA.objCurrentTicket.custom_fields.push(d[i]);
                if (DATA.notEnterprise) {
                  DATA.objTicketForms[1].push(d[i].id);
                }
              }
            }
          }
        }
      });
    }
  });
}

function getCurrentTicketFieldVal() {
  DATA.objCurrentTicket.custom_fields.forEach(function (i) {
    if ((i.type !== 'priority') && (i.type !== 'tickettype') && (i.type !== 'date')) {
      client.get('ticket.customField:' + i.name).then(function (x) {
        i.value = x["ticket.customField:" + i.name];
      });
    } else if (i.type === 'date') {
      client.get('ticket.customField:' + i.name).then(function (x) {
        if (x["ticket.customField:" + i.name] === null) {
          i.value = null;
          return;
        }
        var dateFix = new Date(x["ticket.customField:" + i.name]);
        isoDate = dateFix.toISOString().split('T');
        i.value = isoDate[0];
      });
    }
  });
}

function getExternalID() {
  client.get('ticket.externalId').then(function (id) {
    var exId = id["ticket.externalId"];
    if (notEmpty(exId)) {
      getProjectSearch(exId, 1);
    } else {
      $('#app').render('noproject', {});
    }
    getCurrentTicketFieldVal();
    processTicketFields(1);
    resizeApp();
  }.bind(this), function (error) {
    console.error('Could not get ticket form data', error)
  });
}
/* 
 *   The getProjectSearch has two calls it uses the native search 1st to find all the projects 
 *   related to the external ID. But due to indexing times for search a newly created project will
 *   not return any results. Bewcause we know there is a project to search for we try the tickets 
 *   endpoint which has a faster index then the search. We can not use the tickets endpoint as the
 *   default because any ticket closed for more then 14 days will not be returned in the results. 
 */
function getProjectSearch(intExternalID, intPage, strURL) {
  var objRequest1 = {
    url: '/api/v2/search.json?query=type%3Aticket+order_by%3Acreated+sort%3Adesc+external_id:' + intExternalID,
    type: 'GET',
    dataType: 'json'
  };
  var objRequest2 = {
    url: '/api/v2/tickets.json?external_id=' + intExternalID,
    type: 'GET',
    dataType: 'json'
  };
  client.request(objRequest1).then(function (objData) {
    if (objData.results.length !== 0) {
      //force the search results into a ticket object for projectList 
      objData.tickets = objData.results
      listProjects(objData || {});
    } else {
      client.request(objRequest2).then(function (objData) {
        listProjects(objData || {});
      }.bind(this), function (error) {
        console.error('Could not get ticket form data', error)
      });
    }

  }.bind(this), function (error) {
    console.error('Could not get ticket form data', error)
  });

}

//build a list of assignee names then call the render for the ticket list view
function assigneeName(obj) {
  //if there is no assignee build the list 
  if (obj.assignee_id === null) {
    buildTicketList(obj);
    return;
  }

  var objRequest = {
    url: '/api/v2/users/' + obj.assignee_id + '.json',
    type: 'GET',
    dataType: 'json'
  };
  client.request(objRequest).then(function (objData) {
    DATA.arAssignees[objData.user.id] = objData.user.name;
    buildTicketList(obj);
  }.bind(this), function (error) {
    console.error('Could not get ticket form data', error)
  });
}

function groupName(intGroupID) {

  if (intGroupID === null) {
    return 'None';
  }

  return DATA.objGroups[intGroupID] || 'None';
}

function assignableAgents(strGroupName, intPage) {

  var objRequest = {
    url: '/api/v2/groups/' + strGroupName + '/memberships.json?include=users&page=' + intPage,
    type: 'GET',
    dataType: 'json'
  };

  client.request(objRequest).then(function (objData) {

    $('#assigneeName').attr('class', "spinner dotted");

    DATA.arAssignable = _.map(objData.users, function (objUser) {
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
      $('#assigneeName').attr('disabled', false).removeClass("spinner dotted");
    }

  }.bind(this), function (error) {
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

  var intTicketID = DATA.objTicket.id;

  proceedCreateTicketValues(arGroupSelected, intTicketID, arFieldList);

  var arCurrentTags = DATA.objTicket.tags;

  if (DATA.isProceed) {
    putTicketData(arCurrentTags, 'project_parent', 'add', intTicketID);
  }

}

function proceedCreateTicketValues(arGroupSelected, intTicketID, arFieldList) {

  if (!_.isEmpty(arGroupSelected)) {
    DATA.isProceed = true;
    arGroupSelected.forEach(function (intGroupID) {

      var objRootTicket = {};
      objRootTicket.ticket = {};
      objRootTicket.ticket.ticket_form_id = $('#zendeskForm').val();
      objRootTicket.ticket.subject = $('#userSub').val();

      if (notEmpty($('#dueDate').val())) {
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

      client.metadata().then(function (metadata) {
        objRootTicket.ticket.custom_fields[metadata.settings.Custom_Field_ID] = 'Project-' + intTicketID;
      });

      arFieldList.forEach(function (objField) {
        objRootTicket.ticket.custom_fields[objField.name] = objField.value;
      });


      createTicket(objRootTicket);
    });
  } else {
    client.invoke('notify', 'Please select a group', 'error');
    DATA.isProceed = false;
  }

}

function createTicket(objTicketData) {
  var objRequest = {
    url: '/api/v2/tickets.json',
    type: 'POST',
    dataType: 'json',
    data: objTicketData
  };

  client.request(objRequest).then(function (objData) {
    processData(objData, "add");
  }.bind(this), function (error) {
    console.error('Could not get ticket form data', error)
  });
}

function processData(objData, strType) {
  var intTicketID = DATA.objTicket.id;
  client.set('ticket.customField:custom_field_' + DATA.Custom_Field_ID, 'Project-' + intTicketID);
  // insuring the external is set and if not setting it 
  if (!notEmpty(objData.ticket.external_id)) {
    var objRequest = {
      url: '/api/v2/tickets/' + intTicketID + '.json',
      type: 'PUT',
      dataType: 'json',
      data: '{"ticket":{"external_id": "Project-' + intTicketID + '"}}'
    };

    client.request(objRequest).then(function (objData) {}.bind(this), function (error) {
      console.error('Could not get ticket form data', error)
    });
  }
  if (!_.isUndefined(objData)) {
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

    $('#app').render('description', {
      createResult: DATA.arCreateResultsData
    });

    if (strType == "remove") {
      $('button.child').hide();
      $('button.displayList').hide();
      $('button.parent').show();
    }

    resizeApp();
    //client.invoke('resize', { width: '100%', height: 'auto' });

  }
}

function putTicketData(arTags, strLinking, strType, objData) {
  var arTicketTags = arTags;
  //do not update parent if already tagged aa parent
  if (_.indexOf(arTicketTags, 'project_parent') !== -1) {
    return;
  }
  var isParent = (strLinking === 'project_parent');
  var intTicketUpdateID, objUpdateTicket = {};
  if (_.isObject(objData)) {
    intTicketUpdateID = objData.ticket.id;
  } else {
    intTicketUpdateID = objData;
  }
  objUpdateTicket.ticket = {};
  objUpdateTicket.ticket.custom_fields = {};
  objUpdateTicket.ticket.custom_fields[DATA.Custom_Field_ID] = 'Project-' + DATA.objTicket.id;
  objUpdateTicket.ticket.external_id = 'Project-' + DATA.objTicket.id;
  if (!isParent && strType === 'add') {
    arTicketTags.push(strLinking, 'project_' + DATA.objTicket.id);
  } else if (!isParent && strType === 'remove') {
    var strProjectTag = 'project_' + DATA.objTicket.external_id;
    arTicketTags.splice(_.indexOf(arTags, "project_child"), 1);
    arTicketTags.splice(_.indexOf(arTags, strProjectTag), 1);
    objUpdateTicket.ticket.custom_fields[DATA.Custom_Field_ID] = '';
    objUpdateTicket.ticket.external_id = '';
  } else {
    arTicketTags.push(strLinking, 'project_' + DATA.objTicket.id);
  }
  objUpdateTicket.ticket.tags = arTicketTags;
  putExternalID(objUpdateTicket, intTicketUpdateID, strType);
};

function putExternalID(objTicketData, intTicketUpdateID, strType) {
  var objRequest = {
    url: '/api/v2/tickets/' + intTicketUpdateID + '.json',
    type: 'PUT',
    dataType: 'json',
    data: objTicketData
  };
  client.request(objRequest).then(function (objData) {
    processData(objData, strType);
  }.bind(this), function (error) {
    console.error('Could not get ticket form data', error)
  });
};

function switchToBulk() {
  $('#app').render('multicreate', DATA.ticketFieldcomp);
  var fieldRow = document.getElementById('app');
  var observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      $('#custom-fields-row').render('_fields', DATA.ticketFieldcomp);
    });
  });
  var config = {
    attributes: true,
    childList: true,
    characterData: true
  };
  observer.observe(fieldRow, config);

  resizeApp();

  $('#dueDate').val(DATA.objCurrentTicket.due_at).datepicker({
    dateFormat: 'yy-mm-dd'
  });
  $('#custom-fields-row').render('_fields', DATA.ticketFieldcomp);
  if ($('#zenType').val() === 'task') {
    $('#dueDate').parent().show();
  }


  $('button.displayList').show();
  $('button.displayForm').show();
  $('button.displayMultiCreate').hide();
  autocompleteRequesterEmail();
  $(document).ready(function () {
    if (DATA.notEnterprise) {
      $('#zendeskForm').val(1);
      $('#zendeskForm').parent().hide();
    }
  })

}

function switchToUpdate() {
  $('#app').render('updatetickets', {});
  resizeApp(220);
}

function createBulkTickets() {
  createTicketValues();
}

function updateTickets() {

  var arList = $('#listofIDs').val().split(/,|\s/);
  //update the the current ticket
  var arCurrentTags = DATA.objTicket.tags;

  putTicketData(arCurrentTags, 'project_parent', 'add', DATA.objTicket.id);

  //get the list supplied and update the ticket.
  arList.forEach(function (intTicketID) {
    var objRequest = {
      url: '/api/v2/tickets/' + intTicketID + '.json',
      type: 'GET',
      dataType: 'json',
    };

    client.request(objRequest).then(function (objData) {
      DATA.objCurrentTicket = objData.ticket;

      if (notEmpty) {
        getProjectSearch(objData.ticket.external_id, 1);
      }

      if ((objData.ticket.status !== 'closed') && (_.indexOf(objData.ticket.tags, 'project_child') === -1)) {
        putTicketData(objData.ticket.tags, "project_child", 'add', objData);
      } else if (objData.ticket.status === 'closed') {
        client.invoke('notify', objData.ticket.id + ' is closed', 'error');
      } else if (_.indexOf(objData.ticket.tags, 'project_child') !== -1) {
        client.invoke('notify', 'Ticket ' + objData.ticket.id + ' is already a member of another project: ' + objData.ticket.external_id + ' ', 'error');
      }

    }.bind(this), function (error) {
      console.error('Could not get ticket form data', error)
    });
  });
}

function formSelected() {
  DATA.fieldsHTML = '';
  DATA.currentTicketformID = $('#zendeskForm').val();
  var container1 = document.querySelector('#custom-fields-row');
  var observer1 = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      processTicketFields(1);
    });
  });
  var config = {
    attributes: true,
    childList: true,
    characterData: true,
    subtree: true
  };
  observer1.observe(container1, config);
  $('#custom-fields').remove();
};

//  function getTicketFieldsData (page){
//    processTicketFields(page);
//  }

function removeFromProject() {
  var objx = {};
  objx.ticket = DATA.objTicket
  putTicketData(DATA.objTicket.tags, 'project_child', 'remove', objx);
  client.metadata().then(function (metadata) {
    client.set('ticket.customField:custom_field_' + metadata.settings.Custom_Field_ID, '');
  });
}

function validateJSON(objJSON) {
  try {
    JSON.parse(objJSON);
  } catch (ex) {
    return false;
  }

  return true;
}

function resizeApp(newHeight) {
  if ($('#zenType').val() === 'task') {
    showDate();
  }
  var height;
  if (newHeight) {
    height = newHeight;
  } else {
    height = $('#app')[0].scrollHeight + 50;
  }
  client.invoke('resize', {
    width: '100%',
    height: height + 'px'
  });
}

function getUrlParameter(sParam, strURL) {
  var sPageURL = decodeURIComponent(strURL.substring(1)),
    sURLVariables = sPageURL.split('&'),
    sParameterName,
    i;

  for (i = 0; i < sURLVariables.length; i++) {
    sParameterName = sURLVariables[i].split('=');

    if (sParameterName[0] === sParam) {
      return sParameterName[1] === undefined ? true : sParameterName[1];
    }
  }
}

function stayOnSave(data) {
  DATA.stay_on_save = (data['ticket.postSaveAction'] === 'stay_on_ticket') ? true : false;
}
// check ticket fields for nulls, undfined or empty string
function notEmpty(toCheck) {
  var thereAreNulls = [undefined, null, ''];
  return (_.indexOf(thereAreNulls, toCheck) === -1);
}
// EVENTS
// pull the ticket data again if the parent is updated
client.on('ticket.updated', function () {
  firstData();
});

$(function () {
  $(document).on('click', '.makeproj', function (objData) {
    listProjects(objData);
  });


  $(document).on('click', '.submitSpoke', function () {
    createTicketValues();
  });

  $(document).on('click', '.displayList', function () {
    updateList();
  });

  $(document).on('click', '.displayMultiCreate', function () {
    switchToBulk();
  });

  $(document).on('click', '.displayUpdate', function () {
    switchToUpdate();
  });

  $(document).on('click', '.submitBulk', function () {
    createBulkTickets();
  });

  $(document).on('click', '.updateticket', function () {
    updateTickets();
  });

  $(document).on('change', '#zendeskForm', function () {
    formSelected();
  });

  $(document).on('click', '.removeTicket', function () {
    removeFromProject();
  });

  $(document).on('click', '.open-ticket-tab', function () {
    // get ticket id
    var intTicketID = $(this).data('id');
    // open new ticket tab
    client.invoke('routeTo', 'ticket', intTicketID);
  });

  $(document).on('keyup', '#zendeskGroup', function () {
    autocompleteGroup();
  });

  $(document).on('keyup', '#userEmail', function () {
    autocompleteRequesterEmail();
  });

  $(document).on('keyup', '#assigneeName', function () {
    autocompleteAssignee();
  });

  $(document).on('click', '.displayForm', function () {
    switchToRequester();
  });

  $(document).on('blur', '#zendeskGroup', function () {
    assignableAgents($("#zendeskGSelect").val(), 1);
  });

  $(document).on('click', '.prev-page', function () {
    getProjectSearch(DATA.external_id, DATA.prev_page);
    resizeApp();
  });

  $(document).on('click', '.next-page', function () {
    getProjectSearch(DATA.external_id, DATA.next_page);
    resizeApp();
  });

  $(document).on('change', '#zenType', function () {
    showDate();
    $("#dueDate").datepicker();
    $("#dueDate").datepicker("option", "dateFormat", 'MM d, yy');
  });


  $(document).tooltip({
    tooltipClass: "tooltip-styling"
  });
});
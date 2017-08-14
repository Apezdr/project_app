:warning: *Use of this software is subject to important terms and conditions as set forth in the License file* :warning:

# Project Management App

## Description:

Creates tickets based on a existing ticket in Zendesk. Which are linked together via a external ID, which is searchable. 

## App location:

* Ticket sidebar

## Usage
When viewing a ticket that is not currently in a project a button will be displayed to make a project from this ticket. After clicking the button you will be given the option to create a single ticket or bulk ticket. When clicking either of those buttons the current tickets ticket form, ticket fields, requester, and description will be copied to the ticket form in the app. Creating a single ticket will let you select one group. The bulk ticket will have a multi select box which will allow your to use cntl click to select multiple groups. When sumbiting the app ticket form a ticket will be created for each group selected and a list of tickets created will be displayed. 

## Features:

## Set-up/installation instructions:
* Requires a text field for the project id. This is so views can be built.
* The optional settings map is used to set ticket fields and set groups for bulk ticket creates. It needs to be in a JSON format for example ```{"test1":{"groups":["21280887", "21368503", "21309456","21285363", "21281243", "21276877", "21496437", "21464693", "21309286", "21280308", "21510287", "21387293", "21381016"],"fields":[{"id": 23767108, "value": "termination_wb_fb"}]}, "test1":{"groups":["21280887", "21368503", "21309456","21285363", "21281243", "21276877", "21496437", "21464693", "21309286", "21280308", "21381016", "21368523", "21529906", "21510287"],"fields":[{"id": 23767108, "value": "termination_request_fb"}]}, "test2":{"groups":["21280887", "21368503", "21309456","21285363", "21281243", "21276877", "21496437", "21464693", "21309286", "21280308", "21381016", "21368523", "21529906", "21510287"],"fields":[{"id": 23767108, "value": "termination_request"}]}}```

## Contribution:

Pull requests are welcome.

## Screenshot(s):
The Settings page:
![](/assets/project-app-settings-page.png)

The listing of tickets page:
![](/assets/project-app-ticket-listing.png)

Create single ticket:
![](/assets/project-app-create-single.png)


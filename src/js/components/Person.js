// (C) Copyright 2014-2016 Hewlett Packard Enterprise Development LP

import React, { Component, PropTypes } from 'react';
import { FormattedMessage } from 'react-intl';
import Rest from 'grommet/utils/Rest';
import Anchor from 'grommet/components/Anchor';
import Article from 'grommet/components/Article';
import Box from 'grommet/components/Box';
import Button from 'grommet/components/Button';
import Header from 'grommet/components/Header';
import Menu from 'grommet/components/Menu';
import Paragraph from 'grommet/components/Paragraph';
import Section from 'grommet/components/Section';
import Sidebar from 'grommet/components/Sidebar';
import Split from 'grommet/components/Split';
import Title from 'grommet/components/Title';
import SearchIcon from 'grommet/components/icons/base/Search';
import Details from './Details';
import Logo from './Logo';
import Map from './Map';
import Organization from './Organization';
import PersonGroups from './PersonGroups';
import config from '../config';

const GEONAMES_USERNAME = 'people_finder_app';

export default class Person extends Component {

  constructor () {
    super();
    this._onPersonResponse = this._onPersonResponse.bind(this);
    this._onDetails = this._onDetails.bind(this);
    this._onGroups = this._onGroups.bind(this);
    this._onOrganization = this._onOrganization.bind(this);
    this._onLocationResponse = this._onLocationResponse.bind(this);
    this.state = {
      view: 'organization',
      person: {},
      scope: config.scopes.people
    };
  }

  componentDidMount () {
    this._getPerson(this.props.id);
  }

  componentWillReceiveProps (nextProps) {
    if (nextProps.id !== this.props.id) {
      this._getPerson(nextProps.id);
    }
  }

  _onPersonResponse (err, res) {
    if (err) {
      this.setState({person: {}, error: err});
    } else if (res.ok) {
      const result = res.body;
      const person = result[0];

      this._getLocation(person.hpWorkLocation);
      this.setState({person: person, error: null});
    }
  }

  _getPerson (id) {
    const params = {
      url: encodeURIComponent(config.ldap_base_url),
      base: encodeURIComponent('ou=' + this.state.scope.ou + ',o=' + config.organization),
      scope: 'sub',
      filter: '(uid=' + id + ')'
    };
    Rest.get('/ldap/', params).end(this._onPersonResponse);
  }

  _onLocationResponse (err, res) {
    if (err) {
      this.setState({error: err});
    } else if (res.ok) {
      const result = res.body;
      this._getTimezone(result[0]);
    }
  }

  _getLocation (workLocation) {
    const params = {
      url: encodeURIComponent(config.ldap_base_url),
      base: workLocation,
      scope: 'sub'
    };
    Rest.get('/ldap/', params).end(this._onLocationResponse);
  }

  _onDetails () {
    this.setState({view: 'details'});
  }

  _onGroups () {
    this.setState({view: 'groups'});
  }

  _onOrganization () {
    this.setState({view: 'organization'});
  }

  _formatHourInCity (hour, city, timezone) {
    const ampm = hour >= 12 ? 'pm' : 'am';
    let currentHour = hour % 12;
    // account for midnight
    currentHour = currentHour ? currentHour : 12;

    if (timezone) {
      return `It is ${currentHour}${ampm} in ${city} (${timezone} UTC).`;
    } else {
      return `It is ${currentHour}${ampm} in ${city}.`;
    }
  }

  _getHourFromLDAPTimezone (personTimezone) {
    const currentDate = new Date();
    // converting minutes to milliseconds for localOffset
    const localOffset = currentDate.getTimezoneOffset() * 60000;
    const localTime = currentDate.getTime();
    const localUTC = localTime + localOffset;
    // expect personTimezone to look like "+0100"
    // take positive or negative sign, and convert to int
    const offsetSign = Number.parseInt(personTimezone.substr(0, 1) + '1');
    // taking hours offset
    const personHoursOffset = Number.parseInt(personTimezone.substr(1, 2));
    // taking last two "digits" from string to convert to decimal
    const personMinutesOffset = Number.parseInt(personTimezone.substr(-2)) / 60;
    const personTimezoneOffset = (personHoursOffset + personMinutesOffset) * offsetSign;
    // converting personTimezoneOffset from hours to milliseconds
    const personDate = new Date(localUTC + (3600000 * personTimezoneOffset));

    return personDate.getHours();
  }

  _getTimezone (location) {
    const person = this.state.person;
    let currentPersonTime;

    if (location.latitude && location.longitude) {
      const params = {
        lat: location.latitude,
        lng: location.longitude,
        username: GEONAMES_USERNAME
      };

      Rest
        .get("http://api.geonames.org/timezoneJSON", params)
        .end((err, res) => {
          if (err) {
            this.setState({currentPersonTime: '', error: err});
          } else if (res.ok) {
            const result = res.body;
            const time = result.time;
            const personHour = Number.parseInt(time.substr(11, 2));
            currentPersonTime = this._formatHourInCity(personHour, person.l);

            this.setState({currentPersonTime: currentPersonTime, error: null});
          }
        });
    } else {
      // could not find latitude + longitude, or timeZone
      // properties from LDAP location query
      currentPersonTime = 'No timezone information found.';
      
      if (location.timeZone) {
        // fallback to using timeZone data from LDAP server
        // (which might not be taking DST into account)
        const personTimezone = location.timeZone;
        const personHour = this._getHourFromLDAPTimezone(personTimezone);
        // formatting timezone from LDAP
        const formattedPersonTimezone = `${personTimezone.substr(0,3)}:${personTimezone.substr(3,2)}`;
        currentPersonTime = this._formatHourInCity(personHour, person.l, formattedPersonTimezone);
      }

      this.setState({currentPersonTime: currentPersonTime});
    }
  }

  render () {
    const appTitle = (
      <FormattedMessage id="People Finder" defaultMessage="People Finder" />
    );
    const person = this.state.person;

    let view;
    let viewLabel;
    if ('details' === this.state.view) {
      view = <Details person={person}/>;
      viewLabel = <FormattedMessage id="Details" defaultMessage="Details" />;
    } else if ('groups' === this.state.view) {
      view = <PersonGroups person={person} onSelect={this.props.onSelect} />;
      viewLabel = <FormattedMessage id="Groups" defaultMessage="Groups" />;
    } else if ('organization' === this.state.view) {
      view = <Organization person={person} onSelect={this.props.onSelect} />;
      viewLabel = <FormattedMessage id="Organization" defaultMessage="Organization" />;
    }

    let personTitle;
    if (person.title) {
      personTitle = person.title.replace(/&amp;/g, '&');
    }

    return (
      <Split flex="both" separator={true}>
        <Article>
          <Header large={true} pad={{horizontal: "medium"}} separator="bottom"
            justify="between">
            <Title onClick={this.props.onClose} responsive={false}>
              <Logo />
              {appTitle}
            </Title>
            <Button icon={<SearchIcon />} onClick={this.props.onClose} />
          </Header>
          <Box direction="row" pad="none" align="start">
            <Box pad="medium">
              <img className="avatar" src={person.hpPictureURI || 'img/no-picture.png'} alt="picture" />
            </Box>
            <Section pad="medium" className="flex">
              <Header tag="h1">
                <span>{person.cn}</span>
              </Header>
              <Paragraph margin="none">{personTitle}</Paragraph>
              <Box pad={{vertical: "medium"}}>
                <h2><a href={"mailto:" + person.uid}>{person.uid}</a></h2>
                <h3><a href={"tel:" + person.telephoneNumber}>{person.telephoneNumber}</a></h3>
                <h3>{this.state.currentPersonTime}</h3>
              </Box>
            </Section>
          </Box>
          <Map title={person.o}
            street={person.street} city={person.l} state={person.st}
            postalCode={person.postalCode} country={person.co} />
        </Article>
        <Sidebar>
          <Header large={true} pad={{horizontal: "medium"}} justify="between" separator="bottom">
            <h3>{viewLabel}</h3>
            <Menu label="Menu" dropAlign={{right: 'right'}}>
              <Anchor className={this.state.view === 'organization' ? 'active' : undefined} onClick={this._onOrganization}>
                <FormattedMessage id="Organization" defaultMessage="Organization" />
              </Anchor>
              <Anchor className={this.state.view === 'details' ? 'active' : undefined} onClick={this._onDetails}>
                <FormattedMessage id="Details" defaultMessage="Details" />
              </Anchor>
              <Anchor className={this.state.view === 'groups' ? 'active' : undefined} onClick={this._onGroups}>
                <FormattedMessage id="Groups" defaultMessage="Groups" />
              </Anchor>
              <Anchor href={"http://directoryworks.core.hp.com/protected/people/view/person/normal/?dn=" + person.dn} label="Edit in DirectoryWorks" />
            </Menu>
          </Header>
          {view}
        </Sidebar>
      </Split>
    );
  }

};

Person.propTypes = {
  id: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
  onSelect: PropTypes.func.isRequired
};

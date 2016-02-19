// (C) Copyright 2014-2016 Hewlett Packard Enterprise Development LP

import React, { Component, PropTypes } from 'react';
import { FormattedMessage } from 'react-intl';
import Rest from 'grommet/utils/Rest';
import Header from 'grommet/components/Header';
import Title from 'grommet/components/Title';
import Article from 'grommet/components/Article';
import Section from 'grommet/components/Section';
import List from 'grommet/components/List';
import Button from 'grommet/components/Button';
import PersonListItem from './PersonListItem';
import BusyListItem from './BusyListItem';
import Logo from './Logo';
import config from '../config';

export default class Group extends Component {

  constructor () {
    super();
    this._onGroupResponse = this._onGroupResponse.bind(this);
    this._onOwnersResponse = this._onOwnersResponse.bind(this);
    this._onSelectOwner = this._onSelectOwner.bind(this);
    this.state = {
      group: {},
      owners: [],
      scope: config.scopes.groups,
      peopleScope: config.scopes.people
    };
  }

  componentDidMount () {
    this._getGroup(this.props.id);
  }

  componentWillReceiveProps (newProps) {
    if (newProps.id !== this.props.id) {
      this._getGroup(newProps.id);
    }
  }

  _onOwnersResponse (err, res) {
    if (err) {
      this.setState({owners: [], error: err, busy: false});
    } else if (res.ok) {
      const result = res.body;
      this.setState({owners: result, error: null, busy: false});
    }
  }

  _onGroupResponse (err, res) {
    if (err) {
      this.setState({group: {}, error: err});
    } else if (res.ok) {
      const group = res.body[0];
      this.setState({group: group, owners: [], error: null});

      if (group.owner) {
        this.setState({busy: true});
        const owners = Array.isArray(group.owner) ? group.owner : [group.owner];
        const filter =
          `(|${owners.map(o => (`(${o.split(',')[0]})`)).join('')})`;
        const params = {
          url: encodeURIComponent(config.ldap_base_url),
          base: encodeURIComponent(
            `ou=${this.state.peopleScope.ou},o=${config.organization}`),
          scope: 'sub',
          filter: encodeURIComponent(filter),
          attributes: this.state.peopleScope.attributes
        };
        Rest.get('/ldap/', params).end(this._onOwnersResponse);
      }
    }
  }

  _getGroup (id) {
    const params = {
      url: encodeURIComponent(config.ldap_base_url),
      base: encodeURIComponent(`ou=${this.state.scope.ou},o=${config.organization}`),
      scope: 'sub',
      filter: `(cn=${id})`
    };
    Rest.get('/ldap/', params).end(this._onGroupResponse);
  }

  _onSelectOwner (owner) {
    this.props.onSelect(owner, this.state.peopleScope);
  }

  render () {
    const { group, busy, owners } = this.state;
    const appTitle = (
      <FormattedMessage id="Groups Finder" defaultMessage="Groups Finder" />
    );

    let mails = Array.isArray(group.mail) ? group.mail : [group.mail];
    mails = mails.map(mail => (
      <h2 key={mail}><a href={"mailto:" + mail}>{mail}</a></h2>
    ));

    let ownerItems;
    if (busy) {
      ownerItems = <BusyListItem />;
    } else {
      ownerItems = owners.map((item, index) => (
        <PersonListItem key={item.uid} item={item} first={index === 0}
          onClick={this._onSelectOwner.bind(this, item)} />
      ));
    }

    return (
      <Article>
        <Header large={true} pad={{horizontal: "medium"}} separator="bottom"
          justify="between">
          <Title onClick={this.props.onClose} responsive={false}>
            <Logo />
            {appTitle}
          </Title>
          <Button icon="Search" onClick={this.props.onClose} />
        </Header>
        <Section pad="medium">
          <Header tag="h1" justify="between">
            <span>{group.cn}</span>
          </Header>
          <p>{group.description}</p>
          {mails}
        </Section>
        <Header key="label" tag="h3" pad="medium">
          <FormattedMessage id="Owners" defaultMessage="Owners"
            count={owners.length} />
        </Header>
        <List>
          {ownerItems}
        </List>
      </Article>
    );
  }

};

Group.propTypes = {
  id: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
  onSelect: PropTypes.func.isRequired
};

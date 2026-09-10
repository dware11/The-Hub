'use client';

import { useState } from 'react';
import { EVENT_FILTERS, REGISTERED_EVENT_ORGANIZATIONS } from '../lib/eventCategories';

const FILTER_CLASSES = ['event-category--milestones', 'event-category--college', 'event-category--organizations', 'event-category--campus'];
const FILTER_LABELS = { 'Engineering Student Organizations': 'Student Organizations' };

export default function EventFilterControls({ selected, onToggle, onClear, selectedOrganizations = [], onOrganizationToggle, onOrganizationClear, onClearAll, count, organizations = REGISTERED_EVENT_ORGANIZATIONS, label = 'Filter calendar', defaultCurated = false }) {
  return <div className="event-filter-panel">
    <fieldset>
      <legend>{label}</legend>
      <div className="chip-row">
        <button
          type="button"
          className={`chip ${selected.length === 0 ? 'active' : ''}`}
          aria-pressed={selected.length === 0}
          onClick={onClear}
        >
          All Events
        </button>
        {EVENT_FILTERS.slice(1).map((filter, index) => <button
          type="button"
          className={`chip event-category-chip ${FILTER_CLASSES[index]} ${selected.includes(filter) ? 'active' : ''}`}
          aria-pressed={selected.includes(filter)}
          onClick={() => onToggle(filter)}
          key={filter}
        >
          {FILTER_LABELS[filter] || filter}
        </button>)}
      </div>
    </fieldset>
    {(selected.includes('Engineering Student Organizations') || selectedOrganizations.length > 0) && <fieldset className="organization-filter-group">
      <legend>Organization</legend>
      <OrganizationPicker organizations={organizations} selected={selectedOrganizations} onToggle={onOrganizationToggle} onClear={onOrganizationClear} />
    </fieldset>}
    <div className="event-filter-summary">
      <p aria-live="polite">{count} {count === 1 ? 'event' : 'events'} shown{defaultCurated ? ' in the priority calendar; student-organization programming remains in View All' : selected.length ? ` across ${selected.length} selected categories` : ' across all categories'}{selectedOrganizations.length ? ` for ${selectedOrganizations.length} selected ${selectedOrganizations.length === 1 ? 'organization' : 'organizations'}` : ''}.</p>
      {(selected.length > 0 || selectedOrganizations.length > 0) && <button type="button" className="clear-filters" onClick={onClearAll}>Clear all filters</button>}
    </div>
  </div>;
}

export function OrganizationPicker({ organizations, selected, onToggle, onClear }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const shown = organizations.filter(item => item.label.toLowerCase().includes(query.toLowerCase()));
  return <div className="organization-picker"><button type="button" className="filter-select-trigger" aria-expanded={open} onClick={() => setOpen(value => !value)}>{selected.length ? `${selected.length} selected` : 'All organizations'} <span aria-hidden="true">⌄</span></button>{open && <div className="organization-options"><label className="filter-search"><span className="sr-only">Search organizations</span><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Search organizations…" /></label><label><input type="checkbox" checked={selected.length === 0} onChange={onClear} />All organizations</label>{shown.map(item => <label key={item.value}><input type="checkbox" checked={selected.includes(item.value)} onChange={() => onToggle(item.value)} />{item.label}</label>)}</div>}</div>;
}

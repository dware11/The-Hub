'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { MAJORS } from '../lib/sampleData';
import { matchesSearch } from '../lib/search';
import { OPPORTUNITY_CLASSIFICATIONS, OPPORTUNITY_TYPES, deadlineLabel, normalizeOpportunityClassifications, opportunityCompensationLabel } from '../lib/opportunityOptions';

const PAGE_SIZES = [10, 20, 50];

function values(items, field, fallback = []) {
  const found = items.flatMap((item) => Array.isArray(item[field]) ? item[field] : item[field] ? [item[field]] : []);
  return [...new Set([...fallback, ...found].filter((value) => value && !String(value).toLowerCase().startsWith('all ')))];
}

function matchesClassification(itemValues, selected) {
  if (!selected) return true;
  const list = Array.isArray(itemValues) ? itemValues : [];
  return list.includes('All classifications') || normalizeOpportunityClassifications(list).includes(selected);
}

export default function OpportunitiesBrowser({ items }) {
  const [type, setType] = useState('');
  const [majors, setMajors] = useState([]);
  const [classification, setClassification] = useState('');
  const [workMode, setWorkMode] = useState('');
  const [compensation, setCompensation] = useState('');
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const options = useMemo(() => ({
    types: values(items, 'type', OPPORTUNITY_TYPES.filter((value) => value !== 'Other')),
    majors: values(items, 'majors', MAJORS).filter(value => !['Cybersecurity', 'Data Analytics'].includes(value)),
    classifications: OPPORTUNITY_CLASSIFICATIONS,
  }), [items]);

  const filtered = useMemo(() => items.filter((item) => {
    const itemCompensation = item.compensation_type || (item.paid ? 'Paid' : 'Not specified');
    return matchesSearch([item.title,item.org,item.description], search)
      && (!type || item.type === type)
      && (!majors.length || (item.majors || []).includes('All majors') || (item.majors || []).some(value => majors.includes(value)))
      && matchesClassification(item.classifications, classification)
      && (!workMode || item.work_mode === workMode)
      && (!compensation || (compensation === 'Paid / Funded' ? ['Paid', 'Funded'].includes(itemCompensation) || item.paid : itemCompensation === compensation));
  }), [items, search, type, majors, classification, workMode, compensation]);

  useEffect(() => setPage(1), [type, majors, classification, workMode, compensation, search, pageSize]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  function clearFilters() {
    setSearch(''); setType(''); setMajors([]);
    setClassification('');
    setWorkMode('');
    setCompensation('');
  }

  const activeFilterCount = [type, ...majors, classification, workMode, compensation].filter(Boolean).length;

  return <>
    <div className="opportunity-filter-toolbar"><label className="page-search"><span>Search opportunities</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search title, organization, or description" /></label><button type="button" className="opportunity-filter-toggle" onClick={() => setFiltersOpen(value => !value)} aria-expanded={filtersOpen}>Filters{activeFilterCount ? ` · ${activeFilterCount} active` : ''}</button></div>
    <div className="opportunity-filter-heading"><span>Filters</span><button type="button" className="clear-filters" onClick={clearFilters}>Clear all</button></div>
    <section className={`opportunity-controls${filtersOpen ? ' is-open' : ''}`} aria-label="Opportunity filters">
      <Filter label="Opportunity type" value={type} onChange={setType} options={options.types} />
      <MajorFilter options={options.majors} selected={majors} onChange={setMajors} />
      <Filter label="Classification" value={classification} onChange={setClassification} options={options.classifications} />
      <Filter label="Format" value={workMode} onChange={setWorkMode} options={['Remote', 'Hybrid', 'In person']} />
      <Filter label="Compensation" value={compensation} onChange={setCompensation} options={['Paid / Funded', 'Unpaid', 'Not specified']} />
      <button type="button" className="clear-filters opportunity-clear-mobile" onClick={clearFilters}>Clear filters</button>
      <button type="button" className="apply-filters" onClick={() => setFiltersOpen(false)}>Apply filters</button>
    </section>

    <div className="opportunity-results-head">
      <p><strong>{filtered.length}</strong> {filtered.length === 1 ? 'opportunity' : 'opportunities'}</p>
      <div className="opportunity-result-tools"><label>Show <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>{PAGE_SIZES.map((size) => <option key={size}>{size}</option>)}</select> per page</label></div>
    </div>

    {visible.length ? <div className="opportunity-list">{visible.map((item) => {
      const compensationLabel = opportunityCompensationLabel(item.compensation_type, item.paid);
      const majors = (item.majors || []).filter(value => value && value !== 'All majors').slice(0, 3);
      return <Link className="card opportunity-card opportunity-row" href={'/opportunities/' + item.id} key={item.id}>
        <div className="opportunity-row-main"><div className="opportunity-tags">{item.type && item.type !== 'Other' && <span>{item.type}</span>}{compensationLabel !== 'Not specified' && <span>{compensationLabel}</span>}{item.work_mode && <span>{item.work_mode}</span>}</div>
        <h3>{item.title}</h3><p className="opportunity-org">{item.org || 'Organization not provided'}</p></div>
        <div className="opportunity-row-meta">{majors.length > 0 && <small><strong>Majors</strong> {majors.join(' · ')}</small>}{(item.location || item.work_mode) && !['n/a','not specified'].includes(String(item.location || item.work_mode).trim().toLowerCase()) && <small><strong>Format</strong> {item.location || item.work_mode}</small>}<strong>{item.deadline ? 'Deadline ' + new Date(item.deadline + 'T12:00:00').toLocaleDateString() : deadlineLabel(item.deadline_type, null, item.posted_date)}</strong></div>
      </Link>;
    })}</div> : <div className="empty-results"><h2>No matching opportunities</h2><p>Clear a filter or choose a broader option.</p></div>}

    {pageCount > 1 && <nav className="pagination" aria-label="Opportunity pages">
      <button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)} aria-label="Previous page">←</button>
      {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => <button type="button" key={number} className={number === page ? 'active' : ''} aria-current={number === page ? 'page' : undefined} aria-label={`Go to page ${number}`} onClick={() => setPage(number)}>{number}</button>)}
      <button type="button" disabled={page === pageCount} onClick={() => setPage((value) => value + 1)} aria-label="Next page">→</button>
    </nav>}
  </>;
}

function Filter({ label, value, onChange, options }) {
  return <label><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}><option value="">All</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function MajorFilter({ options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const shown = options.filter(option => option.toLowerCase().includes(query.toLowerCase()));
  const toggle = option => onChange(selected.includes(option) ? selected.filter(value => value !== option) : [...selected, option]);
  const close = event => { if (event.key === 'Escape') { setOpen(false); event.currentTarget.querySelector('.filter-select-trigger')?.focus(); } };
  return <fieldset className="major-multiselect" onKeyDown={close}><legend>Eligible majors</legend><button type="button" className="filter-select-trigger" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(value => !value)}>{selected.length ? `${selected.length} selected` : 'All majors'} <span aria-hidden="true">⌄</span></button>{open && <div className="major-options"><label className="filter-search"><span className="sr-only">Search majors</span><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Search majors…" /></label><label><input type="checkbox" checked={selected.length === 0} onChange={() => onChange([])} />All Majors</label>{shown.map(option => <label key={option}><input type="checkbox" checked={selected.includes(option)} onChange={() => toggle(option)} />{option}</label>)}{selected.length > 0 && <button type="button" className="clear-filters" onClick={() => onChange([])}>Clear majors</button>}</div>}</fieldset>;
}

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon, Avatar, StatusDot } from '../components/ui.jsx';
import { Spinner, ErrorBox, listContainer, listItem, usePaged, Pagination } from '../components/Feedback.jsx';
import { useFetch } from '../hooks/useFetch.js';
import api from '../services/api.js';

export default function StudentsPage({ embedded = false, onOpenStudent, groupId = null }) {
  const [search, setSearch] = useState('');
  const [filterGroup, setFilterGroup] = useState(groupId);

  const { data, loading, error, refetch } = useFetch(
    () => api.students.list({ ...(filterGroup ? { groupId: filterGroup } : {}), limit: 200 }),
    [filterGroup]
  );
  const { data: groupListData } = useFetch(() => api.groups.list({ limit:100 }), []);
  const groupOptions = groupListData?.data ?? [];

  const students = useMemo(() => {
    const all = data ?? [];
    if (!search) return all;
    const q = search.toLowerCase();
    return all.filter(s => (s.name || '').toLowerCase().includes(q));
  }, [data, search]);

  const { page, setPage, totalPages, pageItems, total, pageSize } =
    usePaged(students, 12, [search, filterGroup, students.length]);

  const wrapperProps = embedded
    ? { initial:{ opacity:0 }, animate:{ opacity:1 }, transition:{ duration:0.25 }, style:{ display:'flex', flexDirection:'column', gap:12 } }
    : { className:'page', initial:{ opacity:0, y:8 }, animate:{ opacity:1, y:0 }, transition:{ duration:0.35 } };

  return (
    <motion.div {...wrapperProps}>
      {!embedded && (
        <div className="page-hd">
          <div>
            <h1 className="page-title">O'quvchilar</h1>
            <div className="page-sub">{students.length} ta o'quvchi</div>
          </div>
        </div>
      )}

      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:8 }}>
        <div className="sw" style={{ flex:'1 1 180px' }}>
          <Icon name="search" size={13} color="var(--text-3)"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Qidirish..."/>
        </div>
      </div>

      {!groupId && groupOptions.length > 1 && (
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12, overflowX:'auto', paddingBottom:4 }}>
          <button onClick={() => setFilterGroup(null)}
            style={{
              padding:'6px 12px', borderRadius:8, fontSize:12, whiteSpace:'nowrap',
              background: !filterGroup ? 'var(--primary)' : 'var(--bg-subtle)',
              color: !filterGroup ? '#fff' : 'var(--text-2)',
              border: !filterGroup ? 'none' : '1px solid var(--border)',
              cursor:'pointer',
            }}>
            Barchasi
          </button>
          {groupOptions.map(g => (
            <button key={g._id} onClick={() => setFilterGroup(g._id)}
              style={{
                padding:'6px 12px', borderRadius:8, fontSize:12, whiteSpace:'nowrap',
                background: filterGroup === g._id ? 'var(--primary)' : 'var(--bg-subtle)',
                color: filterGroup === g._id ? '#fff' : 'var(--text-2)',
                border: filterGroup === g._id ? 'none' : '1px solid var(--border)',
                cursor:'pointer',
              }}>
              {g.code || g.name}
            </button>
          ))}
        </div>
      )}

      <AnimatePresence mode="wait">
        {loading ? <motion.div key="l" exit={{ opacity:0 }}><Spinner/></motion.div>
        : error ? <ErrorBox message={error} onRetry={refetch}/>
        : students.length === 0 ? (
          <div style={{ padding:'60px 0', textAlign:'center', color:'var(--text-3)' }}>
            <div style={{ fontSize:40, marginBottom:8 }}>👤</div>
            <div style={{ fontSize:14, fontWeight:600, color:'var(--text-2)' }}>O'quvchilar yo'q</div>
            <div style={{ fontSize:12.5, marginTop:5 }}>Mening guruhlarim → Taklif link orqali qo'shing</div>
          </div>
        ) : (
          <motion.div key="g" variants={listContainer} initial="hidden" animate="show"
            style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {pageItems.map(s => (
              <motion.button key={s._id} variants={listItem}
                onClick={() => onOpenStudent?.(s._id)}
                className="card card-hov"
                style={{
                  padding:14, display:'flex', alignItems:'center', gap:12,
                  textAlign:'left', cursor: onOpenStudent ? 'pointer' : 'default',
                }}>
                <Avatar name={s.name} hue={s.hue || 200} size="md" photoUrl={s.photoUrl}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:14, fontWeight:600 }}>
                    {s.name}
                    <StatusDot status={s.status}/>
                  </div>
                  <div style={{ fontSize:11.5, color:'var(--text-3)', marginTop:2 }}>
                    {s.group?.code ? `${s.group.code} · ` : ''}{s.group?.name || ''}
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div className="prog" style={{ width:50, height:5 }}>
                    <div className="prog-fill" style={{ width:`${s.score || 0}%` }}/>
                  </div>
                  <div style={{ fontFamily:'var(--display)', fontSize:15, fontWeight:700, minWidth:32, textAlign:'right' }}>
                    {s.score || 0}
                  </div>
                </div>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {!loading && !error && (
        <Pagination page={page} totalPages={totalPages} total={total}
          pageSize={pageSize} onPage={setPage} label="o'quvchi"/>
      )}
    </motion.div>
  );
}

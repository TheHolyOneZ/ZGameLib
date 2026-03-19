import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import { api } from "@/lib/tauri";
import { formatDate } from "@/lib/utils";
import type { Note } from "@/lib/types";
import { NoteIcon, PlusIcon, TrashIcon, EditIcon, CheckIcon, CloseIcon } from "@/components/ui/Icons";

function EyeIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M2 12C2 12 5 5 12 5C19 5 22 12 22 12C22 12 19 19 12 19C5 19 2 12 2 12Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}

export default function GameNotes({ gameId }: { gameId: string }) {
  const qc = useQueryClient();
  const [newNote, setNewNote] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);

  const { data: notes = [] } = useQuery({
    queryKey: ["notes", gameId],
    queryFn: () => api.getNotes(gameId),
  });

  const createMutation = useMutation({
    mutationFn: (content: string) => api.createNote(gameId, content),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["notes", gameId] }); setNewNote(""); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) => api.updateNote(id, content),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["notes", gameId] }); setEditingId(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteNote(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes", gameId] }),
  });

  return (
    <div>
      <p className="text-[10px] text-slate-600 uppercase tracking-[0.15em] font-semibold mb-3 flex items-center gap-1.5">
        <NoteIcon size={11} className="text-slate-600" />
        Notes
        {notes.length > 0 && (
          <span className="text-[9px] bg-white/5 px-1.5 py-0.5 rounded-md text-slate-500 ml-1">{notes.length}</span>
        )}
      </p>

      <div className="flex flex-col gap-2 mb-3">
        <AnimatePresence>
          {notes.map((note: Note) => (
            <motion.div
              key={note.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              className="glass rounded-xl p-3.5 group hover:border-accent-500/15 transition-all duration-300"
            >
              {editingId === note.id ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    autoFocus
                    value={editVal}
                    onChange={(e) => setEditVal(e.target.value)}
                    rows={4}
                    className="input-glass text-[13px] resize-none font-mono"
                    placeholder="Supports **markdown**..."
                  />
                  <div className="flex gap-1 justify-end">
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => setEditingId(null)} className="btn-icon w-7 h-7">
                      <CloseIcon size={11} />
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => updateMutation.mutate({ id: note.id, content: editVal })}
                      className="btn-icon w-7 h-7 text-accent-400 border-accent-500/20"
                    >
                      <CheckIcon size={11} />
                    </motion.button>
                  </div>
                </div>
              ) : (
                <>
                  {previewId === note.id ? (
                    <div className="prose prose-invert prose-sm max-w-none text-[13px] leading-relaxed
                      [&_h1]:text-[15px] [&_h2]:text-[14px] [&_h3]:text-[13px]
                      [&_h1]:font-bold [&_h2]:font-semibold [&_h3]:font-semibold
                      [&_h1]:text-white [&_h2]:text-white [&_h3]:text-slate-200
                      [&_p]:text-slate-300 [&_strong]:text-white [&_em]:text-slate-300
                      [&_code]:bg-white/8 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[11px] [&_code]:text-accent-300
                      [&_pre]:bg-white/5 [&_pre]:border [&_pre]:border-white/8 [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:text-[11px]
                      [&_ul]:text-slate-300 [&_ol]:text-slate-300
                      [&_a]:text-accent-400 [&_a]:no-underline [&_a:hover]:underline
                      [&_blockquote]:border-l-2 [&_blockquote]:border-accent-500/40 [&_blockquote]:pl-3 [&_blockquote]:text-slate-400">
                      <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{note.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-[13px] text-slate-300 leading-relaxed whitespace-pre-wrap">{note.content}</p>
                  )}
                  <div className="flex items-center justify-between mt-2.5 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}>
                    <span className="text-[10px] text-slate-700">{formatDate(note.updated_at)}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <motion.button
                        whileTap={{ scale: 0.85 }}
                        onClick={() => setPreviewId(previewId === note.id ? null : note.id)}
                        className={`btn-icon w-6 h-6 ${previewId === note.id ? "text-accent-400 border-accent-500/30" : ""}`}
                        title={previewId === note.id ? "Raw" : "Preview"}
                      >
                        {previewId === note.id ? <EditIcon size={10} /> : <EyeIcon size={10} />}
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.85 }}
                        onClick={() => { setEditVal(note.content); setEditingId(note.id); setPreviewId(null); }}
                        className="btn-icon w-6 h-6"
                      >
                        <EditIcon size={10} />
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.85 }}
                        onClick={() => deleteMutation.mutate(note.id)}
                        className="btn-icon w-6 h-6 hover:text-red-400"
                      >
                        <TrashIcon size={10} />
                      </motion.button>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="flex flex-col gap-2">
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Write a note... (supports **markdown**)"
          rows={2}
          className="input-glass text-[13px] resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.ctrlKey && newNote.trim()) createMutation.mutate(newNote.trim());
          }}
        />
        <AnimatePresence>
          {newNote.trim() && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex justify-between items-center"
            >
              <span className="text-[10px] text-slate-700">Ctrl+Enter to save · supports **markdown**</span>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => createMutation.mutate(newNote.trim())}
                className="btn-primary text-[11px] py-1.5 px-3"
              >
                <PlusIcon size={12} />
                Add Note
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

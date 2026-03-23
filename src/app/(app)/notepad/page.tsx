"use client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { format } from "date-fns";
import { StickyNote, Pin, Trash2, Plus, Check, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";

const INK       = "#0D0D0D";
const INK_LIGHT = "#555550";
const INK_FAINT = "#999990";
const RED       = "#C41E3A";
const RULE_L    = "#CCCCBC";
const GOLD      = "#B08A4E";
const BG        = "#FAFAF5";

type Note = {
  _id: Id<"notes">;
  content: string;
  pinned?: boolean;
  createdAt: number;
  updatedAt: number;
};

function NoteCard({
  note,
  onUpdate,
  onDelete,
  onTogglePin,
}: {
  note: Note;
  onUpdate: (id: Id<"notes">, content: string) => void;
  onDelete: (id: Id<"notes">) => void;
  onTogglePin: (id: Id<"notes">) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(draft.length, draft.length);
    }
  }, [editing]);

  const handleSave = () => {
    if (draft.trim() && draft.trim() !== note.content) {
      onUpdate(note._id, draft.trim());
    } else {
      setDraft(note.content);
    }
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(note.content);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSave();
    }
    if (e.key === "Escape") {
      handleCancel();
    }
  };

  return (
    <div style={{
      background: note.pinned ? "rgba(176,138,78,0.06)" : "#FFFFFF",
      border: `1px solid ${note.pinned ? GOLD : RULE_L}`,
      padding: "16px",
      position: "relative",
      transition: "border-color 0.15s",
    }}>
      {/* Toolbar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: editing ? "10px" : "8px",
      }}>
        <span style={{
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: "10px", color: INK_FAINT, letterSpacing: "0.5px",
        }}>
          {format(new Date(note.updatedAt), "MMM d, yyyy · h:mm a")}
          {note.pinned && (
            <span style={{ color: GOLD, marginLeft: "6px" }}>· pinned</span>
          )}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {editing ? (
            <>
              <button
                onClick={handleSave}
                title="Save (⌘Enter)"
                style={{ background: "none", border: "none", cursor: "pointer", color: "#3A7D44", padding: "2px", display: "flex" }}
              >
                <Check size={14} />
              </button>
              <button
                onClick={handleCancel}
                title="Cancel (Esc)"
                style={{ background: "none", border: "none", cursor: "pointer", color: INK_FAINT, padding: "2px", display: "flex" }}
              >
                <X size={14} />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onTogglePin(note._id)}
                title={note.pinned ? "Unpin" : "Pin to top"}
                style={{ background: "none", border: "none", cursor: "pointer", color: note.pinned ? GOLD : INK_FAINT, padding: "2px", display: "flex", transition: "color 0.15s" }}
              >
                <Pin size={13} fill={note.pinned ? GOLD : "none"} />
              </button>
              <button
                onClick={() => onDelete(note._id)}
                title="Delete"
                style={{ background: "none", border: "none", cursor: "pointer", color: INK_FAINT, padding: "2px", display: "flex", transition: "color 0.15s" }}
                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = RED}
                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = INK_FAINT}
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      {editing ? (
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={4}
          style={{
            width: "100%", boxSizing: "border-box",
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: "13px", lineHeight: "1.6", color: INK,
            background: "transparent", border: `1px solid ${RULE_L}`,
            padding: "8px", resize: "vertical", outline: "none",
          }}
        />
      ) : (
        <p
          onClick={() => setEditing(true)}
          title="Click to edit"
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: "13px", lineHeight: "1.7", color: INK,
            margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word",
            cursor: "text",
          }}
        >
          {note.content}
        </p>
      )}
    </div>
  );
}

export default function NotepadPage() {
  const { userId } = useCurrentUser();
  const notes = (useQuery(api.notes.listByUser, userId ? { userId } : "skip") ?? []) as Note[];
  const createNote  = useMutation(api.notes.create);
  const updateNote  = useMutation(api.notes.update);
  const deleteNote  = useMutation(api.notes.remove);
  const togglePin   = useMutation(api.notes.togglePin);

  const [newContent, setNewContent] = useState("");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (adding && inputRef.current) inputRef.current.focus();
  }, [adding]);

  const pinned   = notes.filter(n => n.pinned);
  const unpinned = notes.filter(n => !n.pinned);
  const sorted   = [...pinned, ...unpinned];

  const handleCreate = async () => {
    if (!userId || !newContent.trim()) return;
    setSaving(true);
    try {
      await createNote({ userId, content: newContent.trim() });
      setNewContent("");
      setAdding(false);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleCreate();
    if (e.key === "Escape") { setNewContent(""); setAdding(false); }
  };

  return (
    <div style={{ padding: "40px 64px", maxWidth: "860px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "32px", borderBottom: `2px solid ${INK}`, paddingBottom: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
            <StickyNote size={20} color={INK} />
            <h1 style={{ fontFamily: "'Playfair Display SC', Georgia, serif", fontSize: "28px", fontWeight: 700, color: INK, margin: 0, letterSpacing: "0.5px" }}>
              Notepad
            </h1>
          </div>
          <p style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "12px", color: INK_LIGHT, margin: 0 }}>
            {notes.length} {notes.length === 1 ? "note" : "notes"} · quick thoughts, ideas &amp; captures
          </p>
        </div>
        <button
          onClick={() => setAdding(v => !v)}
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: "11px", fontWeight: 600, letterSpacing: "1px",
            textTransform: "uppercase", color: adding ? INK_LIGHT : "#FFFFFF",
            background: adding ? "transparent" : INK,
            border: `1px solid ${adding ? RULE_L : INK}`,
            cursor: "pointer", padding: "7px 14px",
            display: "flex", alignItems: "center", gap: "6px",
            transition: "all 0.15s",
          }}
          onMouseEnter={e => { if (!adding) (e.currentTarget as HTMLButtonElement).style.background = RED; (e.currentTarget as HTMLButtonElement).style.borderColor = RED; }}
          onMouseLeave={e => { if (!adding) { (e.currentTarget as HTMLButtonElement).style.background = INK; (e.currentTarget as HTMLButtonElement).style.borderColor = INK; } }}
        >
          <Plus size={13} />
          New Note
        </button>
      </div>

      {/* New note form */}
      {adding && (
        <div style={{ marginBottom: "28px", border: `1px solid ${INK}`, padding: "16px", background: "#FFFFFF" }}>
          <textarea
            ref={inputRef}
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your thought… (⌘Enter to save, Esc to cancel)"
            rows={4}
            style={{
              width: "100%", boxSizing: "border-box",
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: "13px", lineHeight: "1.6", color: INK,
              background: BG, border: `1px solid ${RULE_L}`,
              padding: "10px 12px", resize: "vertical", outline: "none",
              marginBottom: "12px",
            }}
          />
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
            <button
              onClick={() => { setNewContent(""); setAdding(false); }}
              style={{
                fontFamily: "'Inter', system-ui, sans-serif", fontSize: "11px", fontWeight: 600,
                color: INK_LIGHT, background: "transparent", border: `1px solid ${RULE_L}`,
                cursor: "pointer", padding: "6px 14px", letterSpacing: "0.5px",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={saving || !newContent.trim()}
              style={{
                fontFamily: "'Inter', system-ui, sans-serif", fontSize: "11px", fontWeight: 600,
                letterSpacing: "1px", textTransform: "uppercase",
                color: "#FFFFFF", background: newContent.trim() ? INK : INK_FAINT,
                border: "none", cursor: newContent.trim() ? "pointer" : "not-allowed",
                padding: "6px 16px", transition: "background 0.15s",
              }}
              onMouseEnter={e => { if (newContent.trim()) (e.currentTarget as HTMLButtonElement).style.background = RED; }}
              onMouseLeave={e => { if (newContent.trim()) (e.currentTarget as HTMLButtonElement).style.background = INK; }}
            >
              {saving ? "Saving…" : "Save Note"}
            </button>
          </div>
        </div>
      )}

      {/* Notes list */}
      {sorted.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "80px 40px",
          border: `1px dashed ${RULE_L}`, background: "#FFFFFF",
        }}>
          <StickyNote size={32} color={INK_FAINT} style={{ margin: "0 auto 12px" }} />
          <p style={{ fontFamily: "'Playfair Display SC', Georgia, serif", fontSize: "16px", color: INK_FAINT, margin: "0 0 6px" }}>
            No notes yet
          </p>
          <p style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "12px", color: INK_FAINT, margin: 0 }}>
            Hit &ldquo;New Note&rdquo; to capture a quick thought or idea
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {sorted.map(note => (
            <NoteCard
              key={note._id}
              note={note}
              onUpdate={(id, content) => updateNote({ id, content })}
              onDelete={(id) => deleteNote({ id })}
              onTogglePin={(id) => togglePin({ id })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

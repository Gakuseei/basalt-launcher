import { useCallback, useEffect, useState } from "react";
import { ChevronRight, File, Folder, Loader2 } from "lucide-react";

import { api } from "../lib/api";
import { cn } from "../lib/cn";
import { formatBytes } from "../lib/format";
import type { ExportCandidate } from "../lib/types";

export interface ExportRules {
  included: string[];
  excluded: string[];
}

/**
 * Rules are paths with a yes or no. A path takes the nearest rule on its own
 * chain, nothing ruled means out. Same resolution as the Rust side.
 */
function ruleFor(rules: ExportRules, path: string): boolean | null {
  if (rules.included.includes(path)) return true;
  if (rules.excluded.includes(path)) return false;
  return null;
}

export function resolveSelected(rules: ExportRules, path: string): boolean {
  const parts = path.split("/");
  for (let depth = parts.length; depth > 0; depth--) {
    const rule = ruleFor(rules, parts.slice(0, depth).join("/"));
    if (rule !== null) return rule;
  }
  return false;
}

function hasRulesBelow(rules: ExportRules, path: string, value: boolean): boolean {
  const list = value ? rules.included : rules.excluded;
  return list.some((rule) => rule.startsWith(`${path}/`));
}

function withoutBelow(list: string[], path: string) {
  return list.filter((rule) => rule !== path && !rule.startsWith(`${path}/`));
}

export function toggle(rules: ExportRules, path: string, selected: boolean): ExportRules {
  const included = withoutBelow(rules.included, path);
  const excluded = withoutBelow(rules.excluded, path);
  const inherited = resolveSelected({ included, excluded }, path);
  if (inherited === selected) return { included, excluded };
  return selected
    ? { included: [...included, path], excluded }
    : { included, excluded: [...excluded, path] };
}

function Row({
  item,
  depth,
  rules,
  onToggle,
  instanceId,
}: {
  item: ExportCandidate;
  depth: number;
  rules: ExportRules;
  onToggle: (path: string, selected: boolean) => void;
  instanceId: string;
}) {
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState<ExportCandidate[] | null>(null);
  const [loading, setLoading] = useState(false);
  const selected = resolveSelected(rules, item.path);
  const mixed = item.directory && hasRulesBelow(rules, item.path, !selected);

  const expand = useCallback(async () => {
    if (!item.directory) return;
    setOpen((value) => !value);
    if (children !== null) return;
    setLoading(true);
    try {
      setChildren(await api.listExportCandidates(instanceId, item.path));
    } catch {
      setChildren([]);
    } finally {
      setLoading(false);
    }
  }, [children, instanceId, item.directory, item.path]);

  const name = item.path.slice(item.path.lastIndexOf("/") + 1);

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg py-1 pr-2 text-sm transition-colors hover:bg-surface-2",
          !selected && !mixed && "text-content-faint",
        )}
        style={{ paddingLeft: 8 + depth * 18 }}
      >
        <button
          onClick={() => void expand()}
          disabled={!item.directory}
          className="grid size-5 shrink-0 place-items-center text-content-faint disabled:invisible"
          aria-label={open ? "Collapse" : "Expand"}
        >
          {loading ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <ChevronRight className={cn("size-3 transition-transform", open && "rotate-90")} />
          )}
        </button>
        <input
          type="checkbox"
          checked={selected}
          ref={(node) => {
            if (node) node.indeterminate = mixed;
          }}
          onChange={(event) => onToggle(item.path, event.target.checked)}
          className="size-4 shrink-0 accent-(--accent)"
        />
        {item.directory ? (
          <Folder className="size-3.5 shrink-0 text-content-faint" />
        ) : (
          <File className="size-3.5 shrink-0 text-content-faint" />
        )}
        <span className="min-w-0 flex-1 truncate">{name}</span>
        {!item.directory && (
          <span className="shrink-0 font-mono text-[10px] text-content-faint">
            {formatBytes(item.size)}
          </span>
        )}
      </div>
      {open &&
        children?.map((child) => (
          <Row
            key={child.path}
            item={child}
            depth={depth + 1}
            rules={rules}
            onToggle={onToggle}
            instanceId={instanceId}
          />
        ))}
      {open && children?.length === 0 && !loading && (
        <div
          className="py-1 text-[11px] text-content-faint"
          style={{ paddingLeft: 8 + (depth + 1) * 18 + 28 }}
        >
          Empty
        </div>
      )}
    </>
  );
}

export function ExportFileTree({
  instanceId,
  rules,
  onRulesChange,
  onLoaded,
}: {
  instanceId: string;
  rules: ExportRules;
  onRulesChange: (rules: ExportRules) => void;
  onLoaded: (root: ExportCandidate[]) => void;
}) {
  const [root, setRoot] = useState<ExportCandidate[] | null>(null);

  useEffect(() => {
    let live = true;
    setRoot(null);
    api
      .listExportCandidates(instanceId, null)
      .then((items) => {
        if (!live) return;
        setRoot(items);
        onLoaded(items);
      })
      .catch(() => live && setRoot([]));
    return () => {
      live = false;
    };
  }, [instanceId, onLoaded]);

  if (root === null) {
    return (
      <div className="flex items-center justify-center py-8 text-content-faint">
        <Loader2 className="size-4 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-h-64 overflow-y-auto rounded-xl border border-border-soft bg-void/40 py-1">
      {root.map((item) => (
        <Row
          key={item.path}
          item={item}
          depth={0}
          rules={rules}
          onToggle={(path, selected) => onRulesChange(toggle(rules, path, selected))}
          instanceId={instanceId}
        />
      ))}
      {root.length === 0 && (
        <div className="py-6 text-center text-xs text-content-faint">Nothing to export.</div>
      )}
    </div>
  );
}

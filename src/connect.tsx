import {
  List,
  ActionPanel,
  Action,
  Icon,
  showToast,
  Toast,
} from "@raycast/api";
import { runAppleScript } from "@raycast/utils";
import { useState, useEffect } from "react";

interface Connection {
  id: string;
  name: string;
  description: string;
}

function escapeAppleScriptString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function fetchConnections(): Promise<Connection[]> {
  const script = `
    tell application "Royal TSX"
      set conIds to id of every connection
      set conNames to name of every connection
      set conDescriptions to description of every connection
      set conCount to count of conIds
      set output to ""
      repeat with i from 1 to conCount
        if i > 1 then set output to output & linefeed
        set output to output & (item i of conIds) & tab & (item i of conNames) & tab & (item i of conDescriptions)
      end repeat
      return output
    end tell
  `;
  const result = await runAppleScript(script);
  if (!result || result.trim() === "") return [];
  return result
    .trim()
    .split("\n")
    .map((line) => {
      const parts = line.split("\t");
      return {
        id: parts[0] ?? "",
        name: parts[1] ?? "",
        description: parts[2] ?? "",
      };
    })
    .filter((c) => c.id !== "");
}

async function connectToConnection(id: string): Promise<void> {
  const safeId = escapeAppleScriptString(id);
  await runAppleScript(`
    tell application "Royal TSX"
      activate
      connect "${safeId}"
    end tell
  `);
}

async function connectAdHoc(hostname: string): Promise<void> {
  const safeHostname = escapeAppleScriptString(hostname);
  await runAppleScript(`
    tell application "Royal TSX"
      activate
      adhoc "${safeHostname}"
    end tell
  `);
}

function filterConnections(
  connections: Connection[],
  searchText: string,
): Connection[] {
  const normalized = searchText.trim().replace(/\s+/g, " ");
  if (!normalized) return connections;
  const words = normalized.toLowerCase().split(" ");
  return connections.filter((c) =>
    words.every((word) => c.name.toLowerCase().includes(word)),
  );
}

export default function Command() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchConnections()
      .then(setConnections)
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = filterConnections(connections, searchText);
  const showAdHoc = filtered.length === 0 && searchText.trim().length > 0;

  async function handleConnect(id: string) {
    try {
      await showToast({ style: Toast.Style.Animated, title: "Connecting…" });
      await connectToConnection(id);
      await showToast({ style: Toast.Style.Success, title: "Connected" });
    } catch (err) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Connection failed",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function handleAdHoc(hostname: string) {
    try {
      await showToast({ style: Toast.Style.Animated, title: "Connecting…" });
      await connectAdHoc(hostname);
      await showToast({ style: Toast.Style.Success, title: "Connected" });
    } catch (err) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Connection failed",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (error) {
    return (
      <List>
        <List.EmptyView
          icon={Icon.ExclamationMark}
          title="Could not load connections"
          description={error}
        />
      </List>
    );
  }

  return (
    <List
      isLoading={isLoading}
      filtering={false}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search connections…"
    >
      {filtered.map((c) => (
        <List.Item
          key={c.id}
          icon={Icon.Play}
          title={c.name}
          subtitle={c.description}
          actions={
            <ActionPanel>
              <Action title="Connection List" onAction={() => handleConnect(c.id)} />
            </ActionPanel>
          }
        />
      ))}
      {showAdHoc && (
        <List.Item
          key="adhoc"
          icon={Icon.Globe}
          title="Ad Hoc Connection"
          subtitle={searchText.trim()}
          actions={
            <ActionPanel>
              <Action
                title="Connection List"
                onAction={() => handleAdHoc(searchText.trim())}
              />
            </ActionPanel>
          }
        />
      )}
    </List>
  );
}

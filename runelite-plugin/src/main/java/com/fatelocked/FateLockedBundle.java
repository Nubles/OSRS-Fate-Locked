package com.fatelocked;

import com.google.gson.Gson;
import com.google.gson.JsonSyntaxException;
import lombok.Getter;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Parsed bundle exported by the Fate Locked web app.
 *
 * On disk the JSON looks like:
 * <pre>
 * {
 *   "version": 1,
 *   "runId": "run-389c62bb",
 *   "profileName": "Main Account",
 *   "chunkOffset": { "cx": 1, "cy": 7 },
 *   "chunks":        { "Lumbridge": [{"cx":51,"cy":57}], ... },
 *   "unlockedRegions": ["Lumbridge", "Varrock"]
 * }
 * </pre>
 *
 * Chunks in {@code chunks} are stored in the web app's (shifted) coordinate
 * space; this class translates them back to canonical OSRS chunk coordinates
 * (what RuneLite reports via {@code WorldPoint >> 6}) by subtracting the
 * bundle's {@code chunkOffset}. Plugin code therefore never has to think about
 * the offset again.
 */
@Getter
public class FateLockedBundle
{
    private final String runId;
    private final String profileName;

    /** Region name → set of canonical chunks owned by that region. */
    private final Map<String, Set<CanonicalChunk>> regionChunks;

    /** Names of regions the player has unlocked (hierarchy-aware). */
    private final Set<String> unlockedRegions;

    /** Reverse index: canonical chunk → region name (first match wins). */
    private final Map<CanonicalChunk, String> chunkToRegion;

    private FateLockedBundle(String runId, String profileName,
                             Map<String, Set<CanonicalChunk>> regionChunks,
                             Set<String> unlockedRegions,
                             Map<CanonicalChunk, String> chunkToRegion)
    {
        this.runId = runId;
        this.profileName = profileName;
        this.regionChunks = regionChunks;
        this.unlockedRegions = unlockedRegions;
        this.chunkToRegion = chunkToRegion;
    }

    public static FateLockedBundle empty()
    {
        return new FateLockedBundle(null, null,
            Collections.emptyMap(), Collections.emptySet(), Collections.emptyMap());
    }

    public static FateLockedBundle loadFromFile(Path path) throws IOException, JsonSyntaxException
    {
        String json = new String(Files.readAllBytes(path));
        return loadFromJson(json);
    }

    public static FateLockedBundle loadFromJson(String json) throws JsonSyntaxException
    {
        RawBundle raw = new Gson().fromJson(json, RawBundle.class);
        if (raw == null || raw.chunks == null)
        {
            return empty();
        }

        int offsetCx = raw.chunkOffset != null ? raw.chunkOffset.cx : 0;
        int offsetCy = raw.chunkOffset != null ? raw.chunkOffset.cy : 0;

        Map<String, Set<CanonicalChunk>> byRegion = new HashMap<>();
        Map<CanonicalChunk, String> reverse = new HashMap<>();
        for (Map.Entry<String, List<RawChunk>> entry : raw.chunks.entrySet())
        {
            if (entry.getValue() == null) continue;
            Set<CanonicalChunk> chunks = new HashSet<>();
            for (RawChunk rc : entry.getValue())
            {
                CanonicalChunk c = new CanonicalChunk(rc.cx - offsetCx, rc.cy - offsetCy);
                chunks.add(c);
                reverse.putIfAbsent(c, entry.getKey());
            }
            byRegion.put(entry.getKey(), chunks);
        }

        Set<String> unlocked = raw.unlockedRegions == null
            ? Collections.emptySet()
            : new HashSet<>(raw.unlockedRegions);

        return new FateLockedBundle(raw.runId, raw.profileName, byRegion, unlocked, reverse);
    }

    public String regionAt(CanonicalChunk chunk)
    {
        return chunkToRegion.get(chunk);
    }

    public boolean isUnlocked(String region)
    {
        return region != null && unlockedRegions.contains(region);
    }

    // ---- wire format ---------------------------------------------------------

    private static final class RawBundle
    {
        int version;
        String runId;
        String profileName;
        RawChunk chunkOffset;
        Map<String, List<RawChunk>> chunks;
        List<String> unlockedRegions;
    }

    private static final class RawChunk
    {
        int cx;
        int cy;
    }
}

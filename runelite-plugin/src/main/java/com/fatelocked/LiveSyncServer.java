package com.fatelocked;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import lombok.extern.slf4j.Slf4j;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executors;
import java.util.function.Consumer;
import java.util.function.Supplier;

/**
 * Tiny localhost HTTP bridge for live two-way sync with the Fate Locked web app.
 *
 * Uses the JDK's built-in HttpServer (no dependency). Bound to 127.0.0.1 only, so
 * it's never reachable off-machine. Browsers treat http://localhost as a secure
 * origin, so the HTTPS web app can fetch it without mixed-content blocking; we
 * send permissive CORS headers so the cross-origin call is allowed.
 *
 *   GET  /state   → current game snapshot JSON (player, levels, chunk, …)
 *   POST /bundle  → the app's unlock bundle, applied to the plugin live
 *
 * NOTE: a local server makes the plugin ineligible for the RuneLite Plugin Hub
 * (no network), so this is a sideload-only capability behind a config toggle.
 */
@Slf4j
class LiveSyncServer
{
    private final Supplier<String> stateJson;
    private final Consumer<String> onBundle;
    private HttpServer server;

    LiveSyncServer(Supplier<String> stateJson, Consumer<String> onBundle)
    {
        this.stateJson = stateJson;
        this.onBundle = onBundle;
    }

    synchronized void start(int port)
    {
        stop();
        try
        {
            server = HttpServer.create(new InetSocketAddress("127.0.0.1", port), 0);
            server.createContext("/state", this::handleState);
            server.createContext("/bundle", this::handleBundle);
            server.setExecutor(Executors.newSingleThreadExecutor());
            server.start();
            log.info("Fate Locked live-sync server on http://127.0.0.1:{}", port);
        }
        catch (IOException | RuntimeException ex)
        {
            log.warn("Fate Locked live-sync server failed to start on {}: {}", port, ex.getMessage());
            server = null;
        }
    }

    synchronized void stop()
    {
        if (server != null)
        {
            server.stop(0);
            server = null;
        }
    }

    synchronized boolean isRunning()
    {
        return server != null;
    }

    private void cors(HttpExchange ex)
    {
        ex.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
        ex.getResponseHeaders().add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        ex.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type");
    }

    private void send(HttpExchange ex, int code, String body) throws IOException
    {
        byte[] b = body.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().add("Content-Type", "application/json");
        ex.sendResponseHeaders(code, b.length);
        try (OutputStream os = ex.getResponseBody())
        {
            os.write(b);
        }
    }

    private void handleState(HttpExchange ex) throws IOException
    {
        cors(ex);
        if ("OPTIONS".equals(ex.getRequestMethod()))
        {
            ex.sendResponseHeaders(204, -1);
            ex.close();
            return;
        }
        send(ex, 200, stateJson.get());
    }

    private void handleBundle(HttpExchange ex) throws IOException
    {
        cors(ex);
        if ("OPTIONS".equals(ex.getRequestMethod()))
        {
            ex.sendResponseHeaders(204, -1);
            ex.close();
            return;
        }
        if (!"POST".equals(ex.getRequestMethod()))
        {
            send(ex, 405, "{\"ok\":false}");
            return;
        }
        try
        {
            onBundle.accept(new String(readAll(ex.getRequestBody()), StandardCharsets.UTF_8));
            send(ex, 200, "{\"ok\":true}");
        }
        catch (RuntimeException ex2)
        {
            send(ex, 400, "{\"ok\":false}");
        }
    }

    private static byte[] readAll(InputStream is) throws IOException
    {
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        byte[] buf = new byte[4096];
        int n;
        try (InputStream in = is)
        {
            while ((n = in.read(buf)) > 0) bos.write(buf, 0, n);
        }
        return bos.toByteArray();
    }
}

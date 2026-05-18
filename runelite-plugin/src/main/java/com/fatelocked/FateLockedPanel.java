package com.fatelocked;

import net.runelite.client.ui.ColorScheme;
import net.runelite.client.ui.PluginPanel;

import javax.inject.Inject;
import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.JButton;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTextArea;
import javax.swing.SwingUtilities;
import javax.swing.border.EmptyBorder;
import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Component;
import java.awt.Dimension;
import java.awt.Font;
import java.awt.GridLayout;
import java.util.Set;
import java.util.function.Consumer;

/**
 * Side panel for the Fate Locked plugin: live run stats, the player's current
 * chunk + region status, and a paste-box for loading a bundle without touching
 * the config file path.
 */
class FateLockedPanel extends PluginPanel
{
    private final JLabel profileVal = value();
    private final JLabel runIdVal = value();
    private final JLabel regionsVal = value();
    private final JLabel chunksVal = value();
    private final JLabel unlockedVal = value();

    private final JLabel chunkVal = value();
    private final JLabel regionVal = value();
    private final JLabel statusVal = value();

    private final JTextArea pasteArea = new JTextArea(6, 10);

    private Consumer<String> onImport = j -> {};
    private Runnable onReload = () -> {};

    @Inject
    FateLockedPanel()
    {
        setLayout(new BorderLayout());
        setBorder(new EmptyBorder(8, 8, 8, 8));

        JPanel col = new JPanel();
        col.setLayout(new BoxLayout(col, BoxLayout.Y_AXIS));
        col.setBackground(ColorScheme.DARK_GRAY_COLOR);

        col.add(title("FATE LOCKED IRONMAN"));
        col.add(Box.createVerticalStrut(10));

        col.add(section("RUN"));
        col.add(stats(new String[]{ "Profile", "Run ID", "Regions", "Chunks", "Unlocked" },
            new JLabel[]{ profileVal, runIdVal, regionsVal, chunksVal, unlockedVal }));
        col.add(Box.createVerticalStrut(12));

        col.add(section("CURRENT LOCATION"));
        col.add(stats(new String[]{ "Chunk", "Region", "Status" },
            new JLabel[]{ chunkVal, regionVal, statusVal }));
        col.add(Box.createVerticalStrut(12));

        col.add(section("LOAD BUNDLE"));
        col.add(Box.createVerticalStrut(4));

        pasteArea.setLineWrap(true);
        pasteArea.setBackground(ColorScheme.DARKER_GRAY_COLOR);
        pasteArea.setForeground(Color.LIGHT_GRAY);
        pasteArea.setCaretColor(Color.LIGHT_GRAY);
        pasteArea.setBorder(new EmptyBorder(4, 4, 4, 4));
        pasteArea.setToolTipText("Paste the JSON from the web app's RL export button");
        JScrollPane scroll = new JScrollPane(pasteArea);
        scroll.setAlignmentX(Component.LEFT_ALIGNMENT);
        scroll.setMaximumSize(new Dimension(Integer.MAX_VALUE, 110));
        col.add(scroll);
        col.add(Box.createVerticalStrut(6));

        JButton importBtn = new JButton("Import pasted JSON");
        importBtn.setAlignmentX(Component.LEFT_ALIGNMENT);
        importBtn.addActionListener(e -> {
            String txt = pasteArea.getText().trim();
            if (!txt.isEmpty()) onImport.accept(txt);
        });
        col.add(importBtn);
        col.add(Box.createVerticalStrut(4));

        JButton reloadBtn = new JButton("Reload from file");
        reloadBtn.setAlignmentX(Component.LEFT_ALIGNMENT);
        reloadBtn.addActionListener(e -> onReload.run());
        col.add(reloadBtn);

        add(col, BorderLayout.NORTH);
    }

    void setCallbacks(Consumer<String> onImport, Runnable onReload)
    {
        this.onImport = onImport;
        this.onReload = onReload;
    }

    /** Push fresh state into the panel. Safe to call from the client thread. */
    void update(FateLockedBundle bundle, CanonicalChunk current, String region, boolean unlocked)
    {
        int chunkCount = 0;
        for (Set<CanonicalChunk> set : bundle.getRegionChunks().values())
        {
            chunkCount += set.size();
        }
        final int chunks = chunkCount;

        SwingUtilities.invokeLater(() -> {
            profileVal.setText(orDash(bundle.getProfileName()));
            runIdVal.setText(orDash(bundle.getRunId()));
            regionsVal.setText(String.valueOf(bundle.getRegionChunks().size()));
            chunksVal.setText(String.valueOf(chunks));
            unlockedVal.setText(String.valueOf(bundle.getUnlockedRegions().size()));

            chunkVal.setText(current == null ? "—"
                : "(" + current.getCx() + ", " + current.getCy() + ")");
            regionVal.setText(region == null ? "Unauthored" : region);

            if (region == null)
            {
                statusVal.setText("—");
                statusVal.setForeground(Color.GRAY);
            }
            else if (unlocked)
            {
                statusVal.setText("Unlocked");
                statusVal.setForeground(new Color(52, 211, 153));
            }
            else
            {
                statusVal.setText("LOCKED");
                statusVal.setForeground(new Color(248, 113, 113));
            }
        });
    }

    /** Show a one-off message in the run-id row (e.g. import success/failure). */
    void flashStatus(String message, boolean ok)
    {
        SwingUtilities.invokeLater(() -> {
            runIdVal.setText(message);
            runIdVal.setForeground(ok ? new Color(52, 211, 153) : new Color(248, 113, 113));
        });
    }

    // ---- UI builders ---------------------------------------------------------

    private static JLabel title(String text)
    {
        JLabel l = new JLabel(text);
        l.setForeground(new Color(245, 158, 11));
        l.setFont(l.getFont().deriveFont(Font.BOLD, 13f));
        l.setAlignmentX(Component.LEFT_ALIGNMENT);
        return l;
    }

    private static JLabel section(String text)
    {
        JLabel l = new JLabel(text);
        l.setForeground(Color.GRAY);
        l.setFont(l.getFont().deriveFont(Font.BOLD, 10f));
        l.setBorder(new EmptyBorder(0, 0, 4, 0));
        l.setAlignmentX(Component.LEFT_ALIGNMENT);
        return l;
    }

    private static JLabel value()
    {
        JLabel l = new JLabel("—");
        l.setForeground(Color.WHITE);
        return l;
    }

    private static JPanel stats(String[] labels, JLabel[] values)
    {
        JPanel grid = new JPanel(new GridLayout(0, 2, 6, 3));
        grid.setBackground(ColorScheme.DARK_GRAY_COLOR);
        grid.setAlignmentX(Component.LEFT_ALIGNMENT);
        for (int i = 0; i < labels.length; i++)
        {
            JLabel key = new JLabel(labels[i]);
            key.setForeground(Color.LIGHT_GRAY);
            grid.add(key);
            grid.add(values[i]);
        }
        grid.setMaximumSize(new Dimension(Integer.MAX_VALUE, grid.getPreferredSize().height));
        return grid;
    }

    private static String orDash(String s)
    {
        return (s == null || s.isEmpty()) ? "—" : s;
    }
}

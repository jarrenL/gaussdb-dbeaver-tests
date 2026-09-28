/*
 * DBeaver - Universal Database Manager
 * Copyright (C) 2010-2026 DBeaver Corp and others
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package org.jkiss.dbeaver.ui.editors.content;

import org.eclipse.core.runtime.CoreException;
import org.eclipse.core.runtime.NullProgressMonitor;
import org.eclipse.ui.IEditorPart;
import org.jkiss.dbeaver.ui.data.IValueController;
import org.jkiss.dbeaver.ui.editors.StringEditorInput;
import org.jkiss.dbeaver.DBException;
import org.jkiss.dbeaver.model.app.DBPApplicationWorkbench;
import org.jkiss.dbeaver.model.app.DBPPlatform;
import org.jkiss.dbeaver.model.data.DBDContent;
import org.jkiss.dbeaver.model.data.DBDContentStorage;
import org.jkiss.dbeaver.model.runtime.VoidProgressMonitor;
import org.jkiss.dbeaver.runtime.DBWorkbench;
import org.mockito.ArgumentCaptor;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.nio.charset.Charset;
import java.nio.file.Files;
import java.nio.file.Path;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ContentEditorFileImportTest {
    @TempDir Path directory;

    @Test
    void importingTextDoesNotModifyResultSetBeforeExplicitSave() throws Exception {
        var controller = mock(IValueController.class);
        var input = input(controller, "UTF-8");
        var path = directory.resolve("pending.txt");
        Files.writeString(path, "pending replacement");
        input.loadFromExternalFile(path.toFile(), new NullProgressMonitor());
        assertEquals("pending replacement", ((StringEditorInput.StringStorage) field(input, "stringStorage")).getString());
        verify(controller, never()).updateValue(any(), anyBoolean());
        input.release(); // Closing without saving must only release editor-local content.
        verify(controller, never()).updateValue(any(), anyBoolean());
        assertEquals("pending replacement", Files.readString(path));
    }

    private ContentEditorInput input(IValueController controller, String charset) throws Exception {
        var input = mock(ContentEditorInput.class, CALLS_REAL_METHODS);
        field(input, "valueController", controller);
        field(input, "fileCharset", charset);
        field(input, "editorParts", new IEditorPart[0]);
        field(input, "stringStorage", new StringEditorInput("text", "original", false, charset).getStorage());
        when(controller.getValue()).thenReturn("original");
        return input;
    }

    private static void field(ContentEditorInput input, String name, Object value) throws Exception {
        var field = ContentEditorInput.class.getDeclaredField(name);
        field.setAccessible(true);
        field.set(input, value);
    }

    private static Object field(ContentEditorInput input, String name) throws Exception {
        var field = ContentEditorInput.class.getDeclaredField(name);
        field.setAccessible(true);
        return field.get(input);
    }

    @ParameterizedTest
    @ValueSource(strings = {"UTF-8", "UTF-16LE", "GB18030"})
    void textImportUsesEditorEncodingAndCanReplaceWithEmptyFile(String charset) throws Exception {
        var controller = mock(IValueController.class);
        var input = input(controller, charset);
        var storage = field(input, "stringStorage");
        var path = directory.resolve("导入 文本.txt");
        var expected = "中文\nquote'\\end";
        Files.writeString(path, expected, Charset.forName(charset));
        var bytes = Files.readAllBytes(path);
        input.loadFromExternalFile(path.toFile(), new NullProgressMonitor());
        verify(controller, never()).updateValue(any(), anyBoolean());
        assertSame(storage, field(input, "stringStorage"));
        assertEquals(expected, ((StringEditorInput.StringStorage) storage).getString());
        assertEquals(expected.length(), input.getContentLength());
        assertArrayEquals(bytes, Files.readAllBytes(path));
        var empty = directory.resolve("empty.txt");
        Files.write(empty, new byte[0]);
        input.loadFromExternalFile(empty.toFile(), new NullProgressMonitor());
        verify(controller, never()).updateValue(any(), anyBoolean());
        assertEquals("", ((StringEditorInput.StringStorage) storage).getString());
        assertEquals(0, input.getContentLength());
        input.updateContentFromFile(new VoidProgressMonitor(), input.getValue());
        verify(controller).updateValue("", false);
        input.release();
        assertArrayEquals(bytes, Files.readAllBytes(path));
        assertTrue(Files.exists(empty));
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void readFailurePreservesInputAndAllowsRetry(boolean useDirectory) throws Exception {
        var controller = mock(IValueController.class);
        var input = input(controller, "UTF-8");
        var storage = field(input, "stringStorage");
        var originalPath = input.getPath();
        var bad = useDirectory ? directory : directory.resolve("missing.txt");
        assertThrows(CoreException.class, () -> input.loadFromExternalFile(bad.toFile(), new NullProgressMonitor()));
        assertSame(storage, field(input, "stringStorage"));
        assertEquals(originalPath, input.getPath());
        assertEquals("original", ((StringEditorInput.StringStorage) storage).getString());
        assertEquals(8, input.getContentLength());
        verify(controller, never()).updateValue(any(), anyBoolean());
        var valid = directory.resolve("retry.txt");
        Files.writeString(valid, "retry");
        input.loadFromExternalFile(valid.toFile(), new NullProgressMonitor());
        verify(controller, never()).updateValue(any(), anyBoolean());
        assertEquals("retry", ((StringEditorInput.StringStorage) storage).getString());
        assertEquals(5, input.getContentLength());
    }

    @Test
    void rejectedExplicitSavePreservesPendingTextAndAllowsRetry() throws Exception {
        var controller = mock(IValueController.class);
        var input = input(controller, "UTF-8");
        var storage = field(input, "stringStorage");
        var path = directory.resolve("valid.txt");
        Files.writeString(path, "replacement");
        doThrow(new IllegalStateException("Rejected update")).doNothing().when(controller).updateValue("replacement", false);
        input.loadFromExternalFile(path.toFile(), new NullProgressMonitor());
        verify(controller, never()).updateValue(any(), anyBoolean());
        assertThrows(IllegalStateException.class,
            () -> input.updateContentFromFile(new VoidProgressMonitor(), input.getValue()));
        assertSame(storage, field(input, "stringStorage"));
        assertEquals("replacement", ((StringEditorInput.StringStorage) storage).getString());
        assertEquals(11, input.getContentLength());
        input.updateContentFromFile(new VoidProgressMonitor(), input.getValue());
        verify(controller, times(2)).updateValue("replacement", false);
        assertEquals("replacement", ((StringEditorInput.StringStorage) storage).getString());
        assertEquals(11, input.getContentLength());
    }

    @ParameterizedTest
    @ValueSource(strings = {"missing", "directory", "rejected", "same", "alias"})
    void binaryImportPreservesOwnedFileUntilReplacementSucceeds(String scenario) throws Exception {
        var workbenchField = DBWorkbench.class.getDeclaredField("applicationWorkbench");
        workbenchField.setAccessible(true);
        var originalWorkbench = workbenchField.get(null);
        var workbench = mock(DBPApplicationWorkbench.class);
        when(workbench.getPlatform()).thenReturn(mock(DBPPlatform.class));
        workbenchField.set(null, workbench);
        try {
            var controller = mock(IValueController.class);
            var input = input(controller, "UTF-8");
            var content = mock(DBDContent.class);
            when(controller.getValue()).thenReturn(content);
            field(input, "stringStorage", null);
            var original = directory.resolve("owned.bin");
            var originalBytes = new byte[] {1, 2, 3};
            Files.write(original, originalBytes);
            field(input, "contentFile", original.toFile());
            field(input, "contentDetached", false);
            var replacement = directory.resolve("new.bin");
            Files.write(replacement, new byte[] {9, 8});
            boolean same = scenario.equals("same") || scenario.equals("alias");
            if (same) {
                var selected = original;
                if (scenario.equals("alias")) {
                    selected = directory.resolve("link.bin");
                    Files.createSymbolicLink(selected, original);
                }
                input.loadFromExternalFile(selected.toFile(), new NullProgressMonitor());
                assertArrayEquals(originalBytes, Files.readAllBytes(original));
                var storage = ArgumentCaptor.forClass(DBDContentStorage.class);
                verify(content).updateContents(any(), storage.capture());
                try (var stream = storage.getValue().getContentStream()) {
                    assertArrayEquals(originalBytes, stream.readAllBytes());
                }
                input.release();
                assertArrayEquals(originalBytes, Files.readAllBytes(original));
            } else {
                var selected = scenario.equals("missing") ? directory.resolve("missing.bin")
                    : scenario.equals("directory") ? directory : replacement;
                if (scenario.equals("rejected")) {
                    when(content.updateContents(any(), any())).thenThrow(new DBException("Rejected binary update"))
                        .thenReturn(true);
                }
                assertThrows(CoreException.class,
                    () -> input.loadFromExternalFile(selected.toFile(), new NullProgressMonitor()));
                assertArrayEquals(originalBytes, Files.readAllBytes(original));
                assertEquals(original.toString(), input.getPath().toOSString());
                assertEquals(false, field(input, "contentDetached"));
                if (!scenario.equals("rejected")) verify(content, never()).updateContents(any(), any());
                input.loadFromExternalFile(replacement.toFile(), new NullProgressMonitor());
                assertFalse(Files.exists(original), "Successful replacement releases the old owned file");
                assertEquals(replacement.toString(), input.getPath().toOSString());
                assertEquals(2, input.getContentLength());
                input.release();
                assertArrayEquals(new byte[] {9, 8}, Files.readAllBytes(replacement));
            }
        } finally {
            workbenchField.set(null, originalWorkbench);
        }
    }
}

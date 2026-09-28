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
        verify(controller).updateValue(expected, false);
        assertSame(storage, field(input, "stringStorage"));
        assertEquals(expected, ((StringEditorInput.StringStorage) storage).getString());
        assertEquals(expected.length(), input.getContentLength());
        assertArrayEquals(bytes, Files.readAllBytes(path));
        var empty = directory.resolve("empty.txt");
        Files.write(empty, new byte[0]);
        input.loadFromExternalFile(empty.toFile(), new NullProgressMonitor());
        verify(controller).updateValue("", false);
        assertEquals("", ((StringEditorInput.StringStorage) storage).getString());
        assertEquals(0, input.getContentLength());
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
        verify(controller).updateValue("retry", false);
        assertEquals("retry", ((StringEditorInput.StringStorage) storage).getString());
        assertEquals(5, input.getContentLength());
    }

    @Test
    void rejectedControllerUpdatePreservesTextAndAllowsRetry() throws Exception {
        var controller = mock(IValueController.class);
        var input = input(controller, "UTF-8");
        var storage = field(input, "stringStorage");
        var path = directory.resolve("valid.txt");
        Files.writeString(path, "replacement");
        doThrow(new IllegalStateException("Rejected update")).doNothing().when(controller).updateValue("replacement", false);
        assertThrows(CoreException.class, () -> input.loadFromExternalFile(path.toFile(), new NullProgressMonitor()));
        assertSame(storage, field(input, "stringStorage"));
        assertEquals("original", ((StringEditorInput.StringStorage) storage).getString());
        assertEquals(8, input.getContentLength());
        input.loadFromExternalFile(path.toFile(), new NullProgressMonitor());
        verify(controller, times(2)).updateValue("replacement", false);
        assertEquals("replacement", ((StringEditorInput.StringStorage) storage).getString());
        assertEquals(11, input.getContentLength());
    }
}

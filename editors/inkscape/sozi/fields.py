
import inkex

from actions import SoziFieldAction


class SoziField:
    """
    A field is a wrapper for a GTK input control mapped to a Sozi frame attribute.
    Provide a subclass of SoziField for each type of GTK control.
    """

    def __init__(self, parent, attr, default_value, optional=False):
        """
        Initialize a new field.
            - parent: the UI object that contains the current field
            - attr: the frame attribute that corresponds to the current field
            - default_value: the default value of the current field
            - focus_events: True if the GTK input control handles focus events, False otherwise
            - optional: True if this field tolerates None value
        """
        self.parent = parent
        self.ns_attr = inkex.addNS(attr, "sozi")
        
        self.input_widget = parent.builder.get_object(attr + "-field")
        self.label = parent.builder.get_object(attr + "-label")
        if self.label is None:
            self.label = self.input_widget.get_label()
        else:
            self.label = self.label.get_text()
            
        self.optional = optional
        
        if default_value is None:
            self.default_value = None
        else:
            self.default_value = unicode(default_value)

        self.last_value = None
        self.current_frame = None


    def set_value(self, value):
        """
        Fill the GTK control for the current field with the given value.
        The value must be provided as a string or None.
        
        Implemented by subclasses.
        """
        pass


    def get_value(self):
        """
        Return the value of the GTK control for the current field.
        The value is returned as a string or None.
        
        Implemented by subclasses.
        """
        pass


    def reset_last_value(self):
        """
        Set the current value of the input widget as the last submitted value.
        """
        self.last_value = self.get_value()

        
    def write_if_needed(self):
        """
        Write the value of the current field to the SVG document.
        This operation is performed if all these conditions are met:
            - the current field shows a property of an existing frame
            - this frame has not been removed from the document
            - the value of the current field has changed since it was last written
        The write operation is delegated to a SoziFieldAction object.
        """
        if self.current_frame is not None and self.current_frame in self.parent.effect.frames and self.last_value != self.get_value():
            self.parent.do_action(SoziFieldAction(self))
            self.reset_last_value()
            
            
    def set_with_frame(self, frame):
        """
        Set the value of the current field with the corresponding attribute of the given frame.
        If frame is None, the field is filled with its default value and edition is inhibited.
        The previous value of the field is written to the document if needed.
        """
        self.write_if_needed()
        self.current_frame = frame
        if frame is not None and self.ns_attr in frame.attrib:
            self.last_value = frame.attrib[self.ns_attr]
        elif self.optional:
            self.last_value = None
        else:
            self.last_value = self.default_value
        self.set_value(self.last_value)
        self.input_widget.set_sensitive(frame is not None)


    def on_edit_event(self, widget, event=None):
        """
        Default event handler, called each time the current field has been edited.
        Registering this handler is the responsibility of subclasses.
        """
        self.write_if_needed()


class SoziTextField(SoziField):
    """
    A wrapper for a GTK Entry mapped to a Sozi frame attribute.
    """
    
    def __init__(self, parent, attr, default_value, optional=False):
        """
        Initialize a new text field.
        See class SoziField for initializer arguments.
        """
        SoziField.__init__(self, parent, attr, default_value, optional)
        self.input_widget.connect("focus-out-event", self.on_edit_event)


    def set_value(self, value):
        if value is not None:
            self.input_widget.set_text(value)
        else:
            self.input_widget.set_text("")


    def get_value(self):
        value = self.input_widget.get_text()
        if value == "" and self.optional:
            return None
        else:
            return unicode(value)


class SoziComboField(SoziField):
    """
    A wrapper for a GTK ComboBox with text items mapped to a Sozi frame attribute.
    """
    
    def __init__(self, parent, attr, default_value):
        """
        Initialize a new combo field.
            - items: the list of items in the combo box
        See class SoziField for other initializer arguments.
        """
        SoziField.__init__(self, parent, attr, default_value)
        self.changed_handler = self.input_widget.connect("changed", self.on_edit_event)

      
    def set_value(self, value):
        self.input_widget.handler_block(self.changed_handler)
        model = self.input_widget.get_model()
        it = model.get_iter_first()
        while it is not None:
            if model.get_value(it, 0) == value:
                self.input_widget.set_active_iter(it)
                break
            else:
                it = model.iter_next(it)
        self.input_widget.handler_unblock(self.changed_handler)

    
    def get_value(self):
        it = self.input_widget.get_active_iter()
        if it is not None:
            return unicode(self.input_widget.get_model().get_value(it, 0))
        else:
            return unicode(self.default_value)


class SoziToggleField(SoziField):
    """
    A wrapper for a toggle based GTK Widget mapped to a Sozi frame attribute.
    It can match gtk.CheckButton.
    """
    
    def __init__(self, parent, attr, default_value):
        """
        Initialize a new check button field.
        See class SoziField for initializer arguments.
        """
        SoziField.__init__(self, parent, attr, default_value)
        self.toggle_handler = self.input_widget.connect("toggled", self.on_edit_event)


    def set_value(self, value):
        self.input_widget.handler_block(self.toggle_handler)
        self.input_widget.set_active(value == "true")
        self.input_widget.handler_unblock(self.toggle_handler)


    def get_value(self):
        return unicode("true" if self.input_widget.get_active() else "false")


class SoziToggleButtonField(SoziToggleField):
    """
    A wrapper for a GTK ToggleButton mapped to a Sozi frame attribute.
    """

    def __init__(self, parent, attr, on_label, off_label, default_value):
        SoziToggleField.__init__(self, parent, attr, default_value)
        self.on_label = on_label
        self.off_label = off_label


    def update_label(self):
        if self.input_widget.get_active():
            self.input_widget.set_label(self.on_label)
        else:
            self.input_widget.set_label(self.off_label)


    def set_value(self, value):
        SoziToggleField.set_value(self, value)
        self.update_label()


    def on_edit_event(self, widget, event=False):
        SoziToggleField.on_edit_event(self, widget, event)
        self.update_label()


class SoziSpinButtonField(SoziField):
    """
    A wrapper for a GTK SpinButton mapped to a Sozi frame attribute.
    """
    
    def __init__(self, parent, attr, default_value, factor=1):
        """
        Initialize a new spin button field.
            - default_value: the default_value
            - factor : eg: factor 1000 -> comboBox=1.3s ; sozi_svg=1300
        See class SoziField for other initializer arguments.
        """
        factor = float(factor)
        default_value = default_value * factor

        SoziField.__init__(self, parent, attr, default_value)
        self.input_widget.connect("focus-out-event", self.on_edit_event)

        self.factor = factor


    def set_value(self, value):
        self.input_widget.set_value(float(value) / self.factor)


    def get_value(self):
        return unicode(float(self.input_widget.get_value()) * self.factor)


    def on_edit_event(self, widget, event=None):
        self.input_widget.update()
        SoziField.on_edit_event(self, widget, event)

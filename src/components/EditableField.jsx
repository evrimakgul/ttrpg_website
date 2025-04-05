import { Component } from "react";

export default class EditableField extends Component {
  constructor(props) {
    super(props);
    this.state = { value: props.value || 0 };
  }

  handleChange = (e) => {
    const val = parseInt(e.target.value) || 0;
    this.setState({ value: val });
    this.props.onChange(val);
  };

  render() {
    return (
      <input
        type="number"
        className="w-10 text-center px-1 py-0.5 text-sm border border-gray-300 rounded"
        value={this.state.value}
        onChange={this.handleChange}
      />
    );
  }
}

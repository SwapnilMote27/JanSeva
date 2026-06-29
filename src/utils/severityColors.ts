export const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'Critical':
      return {
        border: 'border-red-500',
        text: 'text-red-700 bg-red-50',
        hex: '#C62828'
      };
    case 'High':
      return {
        border: 'border-orange-500',
        text: 'text-orange-700 bg-orange-50',
        hex: '#E65100'
      };
    case 'Medium':
      return {
        border: 'border-yellow-500',
        text: 'text-yellow-700 bg-yellow-50',
        hex: '#F9A825'
      };
    case 'Low':
    default:
      return {
        border: 'border-emerald-500',
        text: 'text-emerald-700 bg-emerald-50',
        hex: '#2E7D32'
      };
  }
};
